import { useState, useEffect, useCallback } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import idl from '@idl/voting_dapp.json'

// Must match ADMIN_PUBKEY in constants.rs
const ADMIN_PUBKEY = '4Dx9jxLKkqM3J7t4R3Q4G3YnzKKvKhJJn5CWVgCFrQD3'

function Admin() {
  const wallet = useWallet()
  const { publicKey } = wallet
  const { connection } = useConnection()
  const [poll, setPoll] = useState(null)
  const [pollName, setPollName] = useState('')
  const [candidateName, setCandidateName] = useState('')
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [feedback, setFeedback] = useState('')

  const isAdmin = publicKey?.toBase58() === ADMIN_PUBKEY

  const buildProgram = useCallback(() => {
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
    return new Program(idl, provider)
  }, [connection, wallet])

  // Derive the single poll PDA
  const getPollPda = useCallback((program) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('poll')],
      program.programId,
    )
  }, [])

  // Fetch poll state and candidates
  const fetchData = useCallback(async () => {
    if (!publicKey) return
    const program = buildProgram()
    const [pollPda] = getPollPda(program)

    try {
      const pollAccount = await program.account.poll.fetch(pollPda)
      setPoll(pollAccount)
    } catch {
      setPoll(null)
    }

    const all = await program.account.candidate.all()
    setCandidates(all.sort((a, b) => a.account.name.localeCompare(b.account.name)))
  }, [publicKey, buildProgram, getPollPda])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Create the poll
  const handleCreatePoll = async () => {
    if (!pollName.trim()) return
    setLoading(true)
    setError(null)
    setFeedback('')
    try {
      const program = buildProgram()
      const [pollPda] = getPollPda(program)
      await program.methods
        .createPoll(pollName.trim())
        .accounts({
          poll: pollPda,
          authority: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
      setFeedback(`Poll "${pollName.trim()}" created.`)
      setPollName('')
      await fetchData()
    } catch (err) {
      setError(err.message || 'Failed to create poll')
    } finally {
      setLoading(false)
    }
  }

  // Toggle voting open/closed
  const handleToggleVoting = async () => {
    setLoading(true)
    setError(null)
    setFeedback('')
    try {
      const program = buildProgram()
      const [pollPda] = getPollPda(program)
      await program.methods
        .toggleVoting()
        .accounts({
          poll: pollPda,
          admin: publicKey,
        })
        .rpc()
      setFeedback(poll.isActive ? 'Voting closed.' : 'Voting opened.')
      await fetchData()
    } catch (err) {
      setError(err.message || 'Failed to toggle voting')
    } finally {
      setLoading(false)
    }
  }

  // Add a candidate
  const handleCreateCandidate = async () => {
    if (!candidateName.trim()) return
    setLoading(true)
    setError(null)
    setFeedback('')
    try {
      const program = buildProgram()
      const trimmed = candidateName.trim()
      const [pollPda] = getPollPda(program)
      const [candidatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('candidate'), Buffer.from(trimmed)],
        program.programId,
      )
      await program.methods
        .createCandidate(trimmed)
        .accounts({
          poll: pollPda,
          candidate: candidatePda,
          admin: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
      setFeedback(`Candidate "${trimmed}" added.`)
      setCandidateName('')
      await fetchData()
    } catch (err) {
      setError(err.message || 'Failed to add candidate')
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) {
    return (
      <section className="page">
        <h2>Admin</h2>
        <div className="card">
          <p>You are not the poll admin.</p>
          <p className="fine-print">Only the designated admin wallet can manage the poll.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page">
      <h2>Admin</h2>

      {/* Poll creation — only shown if no poll exists yet */}
      {!poll ? (
        <div className="card">
          <p>Create a new poll to get started.</p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <input
              type="text"
              value={pollName}
              onChange={e => setPollName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreatePoll()}
              placeholder="Poll name"
              maxLength={64}
              style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #ccc', flex: 1 }}
            />
            <button className="nav-btn inline" onClick={handleCreatePoll} disabled={!pollName.trim() || loading}>
              {loading ? 'Creating…' : 'Create Poll'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Poll info and voting toggle */}
          <div className="card">
            <p>Poll: <strong>{poll.name}</strong></p>
            <p className="fine-print">
              Voting is currently <strong>{poll.isActive ? 'OPEN' : 'CLOSED'}</strong>
            </p>
            <button
              className="nav-btn inline"
              onClick={handleToggleVoting}
              disabled={loading}
              style={{ marginTop: '0.5rem' }}
            >
              {loading ? 'Updating…' : poll.isActive ? 'Close Voting' : 'Open Voting'}
            </button>
          </div>

          {/* Add candidate form */}
          <div className="card">
            <p>Add candidates to the poll.</p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <input
                type="text"
                value={candidateName}
                onChange={e => setCandidateName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateCandidate()}
                placeholder="Candidate name"
                maxLength={64}
                style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #ccc', flex: 1 }}
              />
              <button className="nav-btn inline" onClick={handleCreateCandidate} disabled={!candidateName.trim() || loading}>
                {loading ? 'Creating…' : 'Add Candidate'}
              </button>
            </div>
          </div>
        </>
      )}

      {feedback && <p className="fine-print">{feedback}</p>}
      {error && <p className="fine-print" style={{ color: 'red' }}>{error}</p>}

      {/* Existing candidates list */}
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
