import { useState, useEffect, useCallback } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import idl from '@idl/voting_dapp.json'
import { useDid } from '../context/DidContext.jsx'

function CandidatesVote() {
  const wallet = useWallet()
  const { publicKey } = wallet
  const { connection } = useConnection()
  const { linked } = useDid()
  const [activePolls, setActivePolls] = useState([])
  const [selectedPoll, setSelectedPoll] = useState(null)
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

    // Fetch all polls, filter to active ones
    const allPolls = await program.account.poll.all()
    const active = allPolls.filter(p => p.account.isActive)
    setActivePolls(active)

    // Auto-select the first active poll if none selected
    const current = selectedPoll
      ? active.find(p => p.publicKey.equals(selectedPoll.publicKey))
      : active[0] || null
    setSelectedPoll(current)

    if (!current) {
      setCandidates([])
      setHasVoted(false)
      return
    }

    // Fetch candidates for this poll
    const allCandidates = await program.account.candidate.all()
    const pollCandidates = allCandidates
      .filter(c => c.account.poll.equals(current.publicKey))
      .sort((a, b) => a.account.name.localeCompare(b.account.name))
    setCandidates(pollCandidates)

    // Check if voter has a VoteRecord for this poll
    const [voteRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vote_record'), current.publicKey.toBuffer(), publicKey.toBuffer()],
      program.programId,
    )
    try {
      await program.account.voteRecord.fetch(voteRecordPda)
      setHasVoted(true)
    } catch {
      setHasVoted(false)
    }
  }, [publicKey, buildProgram, selectedPoll?.publicKey?.toBase58()])

  useEffect(() => {
    if (linked) {
      fetchData()
      const interval = setInterval(fetchData, 5000)
      return () => clearInterval(interval)
    }
  }, [linked, fetchData])

  const handleVote = async (candidate) => {
    if (!selectedPoll) return
    setLoading(true)
    setVotingFor(candidate.account.name)
    setError(null)
    try {
      const program = buildProgram()
      const [voterPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('anchor'), publicKey.toBuffer()],
        program.programId,
      )
      const [voteRecordPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vote_record'), selectedPoll.publicKey.toBuffer(), publicKey.toBuffer()],
        program.programId,
      )
      await program.methods
        .vote()
        .accounts({
          poll: selectedPoll.publicKey,
          candidate: candidate.publicKey,
          voter: voterPda,
          voteRecord: voteRecordPda,
          authority: publicKey,
          systemProgram: SystemProgram.programId,
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
      ) : activePolls.length === 0 ? (
        <div className="card">
          <p>No active polls.</p>
          <p className="fine-print">An admin needs to create a poll and open voting.</p>
        </div>
      ) : (
        <>
          {/* Poll selector if multiple active */}
          {activePolls.length > 1 && (
            <div className="card">
              <p>Active polls:</p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {activePolls.map(p => (
                  <button
                    key={p.publicKey.toBase58()}
                    className="nav-btn inline"
                    onClick={() => setSelectedPoll(p)}
                    style={{ fontWeight: selectedPoll?.publicKey.equals(p.publicKey) ? 'bold' : 'normal' }}
                  >
                    {p.account.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedPoll && (
            <div className="card">
              <p>Poll: <strong>{selectedPoll.account.name}</strong></p>
              {candidates.length === 0 ? (
                <p className="fine-print">No candidates yet — ask an admin to add some.</p>
              ) : (
                <>
                  {hasVoted && (
                    <p className="fine-print">You have already cast your vote in this poll.</p>
                  )}
                  <ul>
                    {candidates.map((c) => (
                      <li key={c.account.name} style={{ marginBottom: '0.5rem' }}>
                        {c.account.name} — {c.account.voteCount.toString()} votes{' '}
                        <button
                          className="nav-btn inline"
                          onClick={() => handleVote(c)}
                          disabled={hasVoted || loading}
                        >
                          {loading && votingFor === c.account.name ? 'Voting…' : 'Vote'}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {error && <p className="fine-print" style={{ color: 'red' }}>{error}</p>}
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default CandidatesVote
