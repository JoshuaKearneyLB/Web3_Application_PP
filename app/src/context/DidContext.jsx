import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

const DidContext = createContext(null)


//Component that will wrap the app and gives out DID state
export const DidProvider = ({ children }) => {
  const { publicKey } = useWallet()

  //If a wallet is connected build the DID string with prefix "did:sol:"
  const did = useMemo(
    () => (publicKey ? `did:sol:${publicKey.toBase58()}` : null),
    [publicKey],
  )
  //Has the user linked the DID at this point
  const [linked, setLinked] = useState(false)
  // Locally generated DID document for the connected wallet
  const [didDocument, setDidDocument] = useState(null)

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

  //Reset link state when wallet connection disconnects/changes or page is refreshed etc..
  useEffect(() => {
    setLinked(false)
    setDidDocument(null)
  }, [did])

  //Marks the DID as linked returning true or false for feedback
  const linkDid = () => {
    if (!did) return false
    setLinked(true)
    setDidDocument(buildDidDocument())
    return true
  }

  //Exposes DID to all nested components in the react tree
  return (
    <DidContext.Provider value={{ did, linked, linkDid, didDocument }}>
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
