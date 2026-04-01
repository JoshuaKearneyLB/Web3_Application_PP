import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import idl from '@idl/voting_dapp.json'

const DidContext = createContext(null)

const STORAGE_KEY_PREFIX = 'did_doc_'

//Component that will wrap the app and gives out DID state
export const DidProvider = ({ children }) => {
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
  // On-chain credential data (null if no credential issued)
  const [credential, setCredential] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const hasCredential = Boolean(credential && !credential.isRevoked)

  // Build a DID document derived from the connected wallet.
  // If a credential exists, embed the VC inside the document.
  const buildDidDocument = useCallback((credentialData) => {
    if (!publicKey || !did) return null
    const keyId = `${did}#key-1`
    const doc = {
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
          serviceEndpoint: 'http://localhost:5173/did.json',
        },
      ],
      created: new Date().toISOString(),
    }

    // Embed the VC inside the DID document if a credential exists
    if (credentialData) {
      doc.verifiableCredential = [{
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'VoterEligibilityCredential'],
        issuer: `did:sol:${credentialData.issuer.toBase58()}`,
        issuanceDate: new Date(credentialData.issuedAt.toNumber() * 1000).toISOString(),
        credentialSubject: {
          id: did,
          eligibility: {
            type: 'VoterEligibility',
            eligible: true,
            reason: 'Verified by election administrator',
          },
        },
      }]
    }

    return doc
  }, [did, publicKey])

  // Restore linked state and check credential when wallet changes or page refreshes.
  useEffect(() => {
    setLinked(false)
    setDidDocument(null)
    setCredential(null)
    setError(null)

    if (!publicKey || !wallet.signTransaction) return

    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
    const program = new Program(idl, provider)

    // Check for credential PDA
    const [credentialPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('credential'), publicKey.toBuffer()],
      program.programId,
    )
    program.account.credential.fetch(credentialPda)
      .then((cred) => setCredential(cred))
      .catch(() => setCredential(null))

    // Check for voter PDA (existing linked state)
    const storageKey = STORAGE_KEY_PREFIX + publicKey.toBase58()
    const stored = localStorage.getItem(storageKey)
    if (!stored) return

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
        localStorage.removeItem(storageKey)
      })
  }, [publicKey])

  // Builds the DID document (with embedded VC), calls the on-chain initialize instruction,
  // and persists the document to localStorage only after the transaction confirms.
  const linkDid = async () => {
    if (!did || !publicKey || !wallet.signTransaction || !hasCredential) return false

    setLoading(true)
    setError(null)

    try {
      const doc = buildDidDocument(credential)
      const docJson = JSON.stringify(doc)

      // SHA-256 hash of the document via Web Crypto API
      const hashBuffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(docJson),
      )
      const docHash = Buffer.from(hashBuffer)

      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
      const program = new Program(idl, provider)

      // Derive voter PDA
      const [voterPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('anchor'), publicKey.toBuffer()],
        program.programId,
      )

      // Derive credential PDA
      const [credentialPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('credential'), publicKey.toBuffer()],
        program.programId,
      )

      // Send the initialize transaction — now requires the credential account
      await program.methods
        .initialize(did, doc.service[0].serviceEndpoint, docHash)
        .accounts({
          voter: voterPda,
          credential: credentialPda,
          authority: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      // Only reached if the transaction confirmed
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

  return (
    <DidContext.Provider value={{ did, linked, linkDid, didDocument, credential, hasCredential, loading, error }}>
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
