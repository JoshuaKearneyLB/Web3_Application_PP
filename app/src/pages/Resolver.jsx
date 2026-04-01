import { useState } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import idl from '@idl/voting_dapp.json'

function Resolver() {
  const wallet = useWallet()
  const { connection } = useConnection()
  const [didInput, setDidInput] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleResolve = async () => {
    const trimmed = didInput.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Extract pubkey from did:sol:<pubkey> or accept raw pubkey
      let pubkeyStr = trimmed
      if (trimmed.startsWith('did:sol:')) {
        pubkeyStr = trimmed.slice(8)
      }

      const subjectPubkey = new PublicKey(pubkeyStr)
      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
      const program = new Program(idl, provider)

      // Fetch voter PDA
      const [voterPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('anchor'), subjectPubkey.toBuffer()],
        program.programId,
      )

      let voterAccount = null
      try {
        voterAccount = await program.account.voter.fetch(voterPda)
      } catch {
        // Voter not registered
      }

      // Fetch credential PDA
      const [credentialPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('credential'), subjectPubkey.toBuffer()],
        program.programId,
      )

      let credentialAccount = null
      try {
        credentialAccount = await program.account.credential.fetch(credentialPda)
      } catch {
        // No credential issued
      }

      // Verify DID document hash if voter is registered and has localStorage doc
      let hashVerification = null
      const storedDoc = localStorage.getItem(`did_doc_${pubkeyStr}`)
      if (voterAccount && storedDoc) {
        const hashBuffer = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(storedDoc),
        )
        const computedHash = Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
        const onChainHash = Array.from(voterAccount.docHash)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
        hashVerification = {
          computed: computedHash,
          onChain: onChainHash,
          match: computedHash === onChainHash,
        }
      }

      setResult({
        did: `did:sol:${pubkeyStr}`,
        pubkey: pubkeyStr,
        voterPda: voterPda.toBase58(),
        registered: Boolean(voterAccount),
        credential: credentialAccount ? {
          issuer: credentialAccount.issuer.toBase58(),
          isRevoked: credentialAccount.isRevoked,
          issuedAt: new Date(credentialAccount.issuedAt.toNumber() * 1000).toLocaleString(),
        } : null,
        onChainData: voterAccount ? {
          did: voterAccount.did,
          docUri: voterAccount.docUri,
          docHash: Array.from(voterAccount.docHash).map(b => b.toString(16).padStart(2, '0')).join(''),
          hasVoted: voterAccount.hasVoted,
          authority: voterAccount.authority.toBase58(),
        } : null,
        didDocument: storedDoc ? JSON.parse(storedDoc) : null,
        hashVerification,
      })
    } catch (err) {
      setError('Invalid DID or wallet address. Expected format: did:sol:<pubkey> or a raw base58 pubkey.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="page">
      <h2>DID Resolver</h2>
      <div className="card">
        <p>Resolve a DID to its on-chain data and document.</p>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <input
            type="text"
            value={didInput}
            onChange={e => setDidInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleResolve()}
            placeholder="did:sol:<pubkey> or wallet address"
            style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #ccc', flex: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}
          />
          <button className="nav-btn inline" onClick={handleResolve} disabled={!didInput.trim() || loading}>
            {loading ? 'Resolving…' : 'Resolve'}
          </button>
        </div>
        {error && <p className="fine-print" style={{ color: 'red', marginTop: '0.5rem' }}>{error}</p>}
      </div>

      {result && (
        <>
          {/* DID Identity */}
          <div className="card">
            <p>DID: <code>{result.did}</code></p>
            <p className="fine-print">Voter PDA: <code>{result.voterPda}</code></p>
            <p className="fine-print">
              Status: {result.registered ? (
                <span style={{ color: 'green' }}>Registered</span>
              ) : (
                <span style={{ color: 'grey' }}>Not registered</span>
              )}
            </p>
          </div>

          {/* Credential status */}
          <div className="card">
            <p>Verifiable Credential</p>
            {!result.credential ? (
              <p className="fine-print">No credential issued for this DID.</p>
            ) : result.credential.isRevoked ? (
              <>
                <p className="fine-print" style={{ color: 'red' }}>Credential: Revoked</p>
                <p className="fine-print">Issuer: <code>{result.credential.issuer.slice(0, 12)}…</code></p>
              </>
            ) : (
              <>
                <p className="fine-print" style={{ color: 'green' }}>Credential: Valid</p>
                <p className="fine-print">Issuer: <code>{result.credential.issuer.slice(0, 12)}…</code></p>
                <p className="fine-print">Issued: {result.credential.issuedAt}</p>
              </>
            )}
          </div>

          {/* On-chain voter data */}
          {result.onChainData && (
            <div className="card">
              <p>On-Chain Voter Data</p>
              <p className="fine-print">DID: <code>{result.onChainData.did}</code></p>
              <p className="fine-print">Doc URI: <code>{result.onChainData.docUri}</code></p>
              <p className="fine-print">Doc Hash: <code style={{ wordBreak: 'break-all' }}>{result.onChainData.docHash}</code></p>
              <p className="fine-print">Authority: <code>{result.onChainData.authority.slice(0, 12)}…</code></p>
            </div>
          )}

          {/* Hash verification */}
          {result.hashVerification && (
            <div className="card">
              <p>Hash Verification</p>
              <p className="fine-print">Computed: <code style={{ wordBreak: 'break-all' }}>{result.hashVerification.computed}</code></p>
              <p className="fine-print">On-chain: <code style={{ wordBreak: 'break-all' }}>{result.hashVerification.onChain}</code></p>
              <p className="fine-print" style={{ color: result.hashVerification.match ? 'green' : 'red' }}>
                {result.hashVerification.match ? 'Match: Document is authentic' : 'MISMATCH: Document may have been tampered with'}
              </p>
            </div>
          )}

          {/* DID Document */}
          {result.didDocument && (
            <div className="card">
              <p>DID Document (from localStorage):</p>
              <pre className="fine-print" style={{ whiteSpace: 'pre-wrap' }}>
{JSON.stringify(result.didDocument, null, 2)}
              </pre>
            </div>
          )}

          {!result.registered && !result.credential && (
            <div className="card">
              <p className="fine-print">This DID has no on-chain presence. The wallet has not been credentialed or registered.</p>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default Resolver
