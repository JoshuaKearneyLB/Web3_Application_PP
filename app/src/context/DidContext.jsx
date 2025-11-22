import { createContext, useContext, useEffect, useMemo, useState } from 'react'
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

  //Reset link state when wallet connection disconnects/changes or page is refreshed etc..
  useEffect(() => {
    setLinked(false)
  }, [did])

  //Marks the DID as linked returning true or false for feedback
  const linkDid = () => {
    if (!did) return false
    setLinked(true)
    return true
  }

  //Exposes DID to all nested components in the react tree
  return (
    <DidContext.Provider value={{ did, linked, linkDid }}>
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
