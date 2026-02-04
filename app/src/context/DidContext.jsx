import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import idl from '@idl/voting_dapp.json'

const DidContext = createContext(null)

const STORAGE_KEY_PREFIX = 'did_doc_'

//Component that will wrap the app and gives out DID state
export const DidProvider = ({ children }) => {
  // useWallet() returns WalletContextState — the whole object satisfies AnchorProvider's
  // wallet interface (publicKey, signTransaction, signAllTransactions at top level)
  const wallet = useWallet()
  const { publicKey } = wallet
  const { connection } = useConnection()

  //If a wallet is connected build the DID string with prefix "did:sol:"
  const did = useMemo(
    () => (publicKey ? `did:sol:${publicKey.toBase58()}` : null),
    [publicKey],
  )
  //Has the user linked the DID at this point
  const [linked, setLinked] = useState(false)
  // Locally generated DID document for the connected wallet
  const [didDocument, setDidDocument] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Build a simple DID document derived from the connected wallet.
  const buildDidDocument = useCallback(() => {
    if (!publicKey || !did) return null
    const keyId = `${did}#key-1`
    return {
      id: did,
      verificationMethod: [
        {
          id: keyId,
          type: 'Ed25519VerificationKey2018',
          controller: did,
          publicKeyBase58: publicKey.toBase58(),
        },
      ],
      authentication: [keyId],
      assertionMethod: [keyId],
      service: [
        {
          id: `${did}#resolver`,
          type: 'DIDResolutionService',
          // Placeholder endpoint for local/demo use; replace when wiring a resolver.
          serviceEndpoint: 'http://localhost:5173/did.json',
        },
      ],
      created: new Date().toISOString(),
    }
  }, [did, publicKey])

  // Restore linked state when wallet changes or page refreshes.
  // Checks localStorage first, then verifies the on-chain voter PDA still exists.
  // If the chain was wiped (e.g. localnet restart) the stale localStorage entry is removed.
  useEffect(() => {
    setLinked(false)
    setDidDocument(null)
    setError(null)

    if (!publicKey || !wallet.signTransaction) return

    const storageKey = STORAGE_KEY_PREFIX + publicKey.toBase58()
    const stored = localStorage.getItem(storageKey)
    if (!stored) return

    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
    const program = new Program(idl, provider)
    const [voterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('anchor'), publicKey.toBuffer()],
      program.programId,
    )

    program.account.voter.fetch(voterPda)
      .then(() => {
        setDidDocument(JSON.parse(stored))
        setLinked(true)
      })
      .catch(() => {
        // On-chain account gone (chain was reset) — drop stale local copy
        localStorage.removeItem(storageKey)
      })
  }, [publicKey]) // wallet and connection are stable provider references

  // Builds the DID document, calls the on-chain initialize instruction,
  // and persists the document to localStorage only after the transaction confirms.
  const linkDid = async () => {
    if (!did || !publicKey || !wallet.signTransaction) return false

    setLoading(true)
    setError(null)

    try {
      const doc = buildDidDocument()
      const docJson = JSON.stringify(doc)

      // SHA-256 hash of the document via Web Crypto API — no Node crypto needed
      const hashBuffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(docJson),
      )
      const docHash = Buffer.from(hashBuffer)

      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
      const program = new Program(idl, provider)

      // Derive voter PDA — seeds must match the Rust SEED constant ("anchor") exactly
      const [voterPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('anchor'), publicKey.toBuffer()],
        program.programId,
      )

      // Send the initialize transaction; Anchor handles serialization and confirmation
      await program.methods
        .initialize(did, doc.service[0].serviceEndpoint, docHash)
        .accounts({
          voter: voterPda,
          authority: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      // Only reached if the transaction confirmed — persist locally and flip state
      localStorage.setItem(STORAGE_KEY_PREFIX + publicKey.toBase58(), docJson)
      setDidDocument(doc)
      setLinked(true)
      return true
    } catch (err) {
      setError(err.message || 'Transaction failed')
      return false
    } finally {
      setLoading(false)
    }
  }

  //Exposes DID to all nested components in the react tree
  return (
    <DidContext.Provider value={{ did, linked, linkDid, didDocument, loading, error }}>
      {children}
    </DidContext.Provider>
  )
}

//Hook to read DID context; throws error if outside provider
export const useDid = () => {
  const ctx = useContext(DidContext)
  if (!ctx) {
    throw new Error('useDid must be used within a DidProvider')
  }
  return ctx
}
