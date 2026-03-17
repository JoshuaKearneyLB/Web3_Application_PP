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
      ) : (
        <div className="card">
          {candidates.length === 0 ? (
            <p>No candidates yet — ask an admin to add some.</p>
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
                      disabled={hasVoted || loading}
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
