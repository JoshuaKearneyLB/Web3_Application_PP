import { useState, useEffect, useCallback } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import idl from '@idl/voting_dapp.json'
import { useDid } from '../context/DidContext.jsx'

function CandidatesVote() {
  const wallet = useWallet()
  const { publicKey } = wallet
  const { connection } = useConnection()
  const { linked } = useDid()
  const [poll, setPoll] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [hasVoted, setHasVoted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [votingFor, setVotingFor] = useState(null)
  const [error, setError] = useState(null)

  const buildProgram = useCallback(() => {
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
    return new Program(idl, provider)
  }, [connection, wallet])

  const fetchData = useCallback(async () => {
    if (!publicKey) return
    const program = buildProgram()

    // Fetch poll state
    const [pollPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('poll')],
      program.programId,
    )
    try {
      const pollAccount = await program.account.poll.fetch(pollPda)
      setPoll(pollAccount)
    } catch {
      setPoll(null)
    }

    // Fetch candidates
    const all = await program.account.candidate.all()
    setCandidates(all.sort((a, b) => a.account.name.localeCompare(b.account.name)))

    // Check if this voter has already voted
    const [voterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('anchor'), publicKey.toBuffer()],
      program.programId,
    )
    try {
      const voter = await program.account.voter.fetch(voterPda)
      setHasVoted(voter.hasVoted)
    } catch {
      setHasVoted(false)
    }
  }, [publicKey, buildProgram])

  useEffect(() => {
    if (linked) fetchData()
  }, [linked, fetchData])

  const handleVote = async (candidate) => {
    setLoading(true)
    setVotingFor(candidate.account.name)
    setError(null)
    try {
      const program = buildProgram()
      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('poll')],
        program.programId,
      )
      const [candidatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('candidate'), Buffer.from(candidate.account.name)],
        program.programId,
      )
      const [voterPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('anchor'), publicKey.toBuffer()],
        program.programId,
      )
      await program.methods
        .vote()
        .accounts({
          poll: pollPda,
          candidate: candidatePda,
          voter: voterPda,
          authority: publicKey,
        })
        .rpc()
      await fetchData()
    } catch (err) {
      setError(err.message || 'Vote failed')
    } finally {
      setLoading(false)
      setVotingFor(null)
    }
  }

  return (
    <section className="page">
      <h2>Candidates &amp; Vote</h2>
      {!linked ? (
        <div className="card">
          <p>Link your DID on the Profile page before voting.</p>
          <p className="fine-print">Voting is disabled until your DID is linked.</p>
        </div>
      ) : !poll ? (
        <div className="card">
          <p>No poll has been created yet.</p>
          <p className="fine-print">An admin needs to create a poll first.</p>
        </div>
      ) : (
        <div className="card">
          <p>Poll: <strong>{poll.name}</strong></p>
          {!poll.isActive && (
            <p className="fine-print" style={{ color: 'orange' }}>Voting is currently closed.</p>
          )}
          {candidates.length === 0 ? (
            <p className="fine-print">No candidates yet — ask an admin to add some.</p>
          ) : (
            <>
              {hasVoted && (
                <p className="fine-print">You have already cast your vote in this poll.</p>
              )}
              <ul>
                {candidates.map(({ account }) => (
                  <li key={account.name} style={{ marginBottom: '0.5rem' }}>
                    {account.name} — {account.voteCount.toString()} votes{' '}
                    <button
                      className="nav-btn inline"
                      onClick={() => handleVote({ account })}
                      disabled={hasVoted || loading || !poll.isActive}
                    >
                      {loading && votingFor === account.name ? 'Voting…' : 'Vote'}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {error && <p className="fine-print" style={{ color: 'red' }}>{error}</p>}
        </div>
      )}
    </section>
  )
}

export default CandidatesVote
