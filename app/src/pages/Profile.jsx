import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useDid } from '../context/DidContext.jsx'

function Profile() {
  const { publicKey } = useWallet()
  const { did, linked, linkDid } = useDid()
  const [feedback, setFeedback] = useState('')

  const handleLink = () => {
    const ok = linkDid()
    setFeedback(ok ? 'DID linked for this wallet.' : 'Connect a wallet first.')
  }

  return (
    <section className="page">
      <h2>Profile / DID</h2>
      <p className="page-preview">This is the Profile/DID page.</p>
      <div className="card">
        <p>Wallet DID, VC status, and registration actions will live here.</p>
        <ul>
          <li>
            Show DID: {did ? <code>{did}</code> : 'Connect wallet to derive DID'}
          </li>
          <li>Show fake VC (eligibility) and region</li>
          <li>Button to link DID before registering to vote</li>
          <li>Button to register to vote</li>
        </ul>
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="nav-btn inline" onClick={handleLink} disabled={!did}>
            {linked ? 'DID Linked' : 'Link DID'}
          </button>
          <span className="fine-print">
            {linked ? 'Ready to register and vote.' : 'Link your DID to proceed.'}
          </span>
        </div>
        {feedback && <p className="fine-print">{feedback}</p>}
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
