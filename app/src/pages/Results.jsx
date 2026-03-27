import { useState, useEffect, useCallback } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import idl from '@idl/voting_dapp.json'

function Results() {
  const wallet = useWallet()
  const { publicKey } = wallet
  const { connection } = useConnection()
  const [poll, setPoll] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchResults = useCallback(async () => {
    if (!publicKey) return
    setLoading(true)
    try {
      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
      const program = new Program(idl, provider)

      // Fetch poll
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

      // Fetch candidates sorted by votes (highest first)
      const all = await program.account.candidate.all()
      setCandidates(all.sort((a, b) => b.account.voteCount.toNumber() - a.account.voteCount.toNumber()))
    } finally {
      setLoading(false)
    }
  }, [connection, wallet, publicKey])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])

  return (
    <section className="page">
      <h2>Results</h2>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p>{poll ? <><strong>{poll.name}</strong> — {poll.isActive ? 'Voting open' : 'Voting closed'}</> : 'No poll created yet.'}</p>
          <button className="nav-btn inline" onClick={fetchResults} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        {candidates.length === 0 ? (
          <p className="fine-print">No candidates yet.</p>
        ) : (
          <ul>
            {candidates.map(({ account }) => (
              <li key={account.name}>
                {account.name}: {account.voteCount.toString()} votes
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default Results
