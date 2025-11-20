import './App.css'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useWallet } from '@solana/wallet-adapter-react'

function App() {
  const { publicKey } = useWallet()

  return (
    <main className="app">
      <h1>Voting DApp</h1>
      <p>Connect a wallet to start interacting with the on-chain program.</p>
      <WalletMultiButton />
      {publicKey && (
        <p className="status">
          Connected wallet: <code>{publicKey.toBase58()}</code>
        </p>
      )}
    </main>
  )
}

export default App
