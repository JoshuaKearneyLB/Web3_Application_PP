import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useDid } from '../context/DidContext.jsx'

function Profile() {
  const { publicKey } = useWallet()
  const { did, linked, linkDid, didDocument, credential, hasCredential, loading, error } = useDid()
  const [feedback, setFeedback] = useState('')

  const handleLink = async () => {
    setFeedback('')
    const ok = await linkDid()
    if (ok) setFeedback('DID linked and registered on-chain.')
  }

  return (
    <section className="page">
      <h2>Profile / DID</h2>
      <div className="card">
        <p>
          DID: {did ? <code>{did}</code> : 'Connect wallet to derive DID'}
        </p>
      </div>

      {/* Verifiable Credential status */}
      <div className="card">
        <p>Verifiable Credential</p>
        {!credential ? (
          <p className="fine-print">No credential issued. Contact the admin to get authorized.</p>
        ) : credential.isRevoked ? (
          <p className="fine-print" style={{ color: 'red' }}>Credential: Revoked</p>
        ) : (
          <>
            <p className="fine-print" style={{ color: 'green' }}>Credential: Valid</p>
            <p className="fine-print">
              Issuer: <code>{credential.issuer.toBase58().slice(0, 12)}…</code>
            </p>
            <p className="fine-print">
              Issued: {new Date(credential.issuedAt.toNumber() * 1000).toLocaleString()}
            </p>
          </>
        )}
      </div>

      {/* Link DID button — requires valid credential */}
      <div className="card">
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="nav-btn inline" onClick={handleLink} disabled={!did || loading || linked || !hasCredential}>
            {loading ? 'Signing…' : linked ? 'DID Linked' : 'Link DID'}
          </button>
          <span className="fine-print">
            {linked
              ? 'Registered and ready to vote.'
              : hasCredential
                ? 'Link your DID to register.'
                : 'Waiting for admin to issue credential.'}
          </span>
        </div>
        {feedback && <p className="fine-print">{feedback}</p>}
        {error && <p className="fine-print" style={{ color: 'red' }}>{error}</p>}
      </div>

      {/* DID document with embedded VC */}
      {linked && didDocument && (
        <div className="card">
          <p>DID document (with embedded Verifiable Credential):</p>
          <pre className="fine-print" style={{ whiteSpace: 'pre-wrap' }}>
{JSON.stringify(didDocument, null, 2)}
          </pre>
        </div>
      )}

      {publicKey && (
        <p className="status">
          Connected wallet: <code>{publicKey.toBase58()}</code>
        </p>
      )}
    </section>
  )
}

export default Profile
