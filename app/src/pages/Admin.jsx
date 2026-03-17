import { useState, useEffect, useCallback } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import idl from '@idl/voting_dapp.json'

function Admin() {
  const wallet = useWallet()
  const { publicKey } = wallet
  const { connection } = useConnection()
  const [name, setName] = useState('')
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [feedback, setFeedback] = useState('')

  const buildProgram = useCallback(() => {
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
    return new Program(idl, provider)
  }, [connection, wallet])

  const fetchCandidates = useCallback(async () => {
    if (!publicKey) return
    const program = buildProgram()
    const all = await program.account.candidate.all()
    setCandidates(all.sort((a, b) => a.account.name.localeCompare(b.account.name)))
  }, [publicKey, buildProgram])

  useEffect(() => {
    fetchCandidates()
  }, [fetchCandidates])

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    setFeedback('')
    try {
      const program = buildProgram()
      const trimmed = name.trim()
      const [candidatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('candidate'), Buffer.from(trimmed)],
        program.programId,
      )
      await program.methods
        .createCandidate(trimmed)
        .accounts({
          candidate: candidatePda,
          authority: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
      setFeedback(`Candidate "${trimmed}" added to the poll.`)
      setName('')
      await fetchCandidates()
    } catch (err) {
      setError(err.message || 'Transaction failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="page">
      <h2>Admin</h2>
      <div className="card">
        <p>Add candidates to the poll.</p>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Candidate name"
            maxLength={64}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #ccc', flex: 1 }}
          />
          <button className="nav-btn inline" onClick={handleCreate} disabled={!name.trim() || loading}>
            {loading ? 'Creating…' : 'Add Candidate'}
          </button>
        </div>
        {feedback && <p className="fine-print">{feedback}</p>}
        {error && <p className="fine-print" style={{ color: 'red' }}>{error}</p>}
      </div>
      {candidates.length > 0 && (
        <div className="card">
          <p>Current candidates on-chain:</p>
          <ul>
            {candidates.map(({ account }) => (
              <li key={account.name}>
                {account.name} — {account.voteCount.toString()} votes
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default Admin
