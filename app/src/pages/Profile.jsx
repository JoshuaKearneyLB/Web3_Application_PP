import { useWallet } from '@solana/wallet-adapter-react'

function Profile() {
  const { publicKey } = useWallet()

  return (
    <section className="page">
      <h2>Profile / DID</h2>
      <p className="page-preview">This is the Profile/DID page.</p>
      <div className="card">
        <p>Wallet DID, VC status, and registration actions will live here.</p>
        <ul>
          <li>Show DID: did:sol:&lt;publicKey&gt;</li>
          <li>Show fake VC (eligibility) and region</li>
          <li>Button to register to vote</li>
        </ul>
      </div>
      {publicKey && (
        <p className="status">
          Connected wallet: <code>{publicKey.toBase58()}</code>
        </p>
      )}
    </section>
  )
}

export default Profile
