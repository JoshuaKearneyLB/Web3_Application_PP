import { useState, useEffect, useCallback } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import idl from '@idl/voting_dapp.json'

function Results() {
  const wallet = useWallet()
  const { publicKey } = wallet
  const { connection } = useConnection()
  const [polls, setPolls] = useState([])
  const [selectedPoll, setSelectedPoll] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchResults = useCallback(async () => {
    if (!publicKey) return
    setLoading(true)
    try {
      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
      const program = new Program(idl, provider)

      const allPolls = await program.account.poll.all()
      setPolls(allPolls)

      // Auto-select first poll if none selected
      const current = selectedPoll
        ? allPolls.find(p => p.publicKey.equals(selectedPoll.publicKey))
        : allPolls[0] || null
      setSelectedPoll(current)

      const allCandidates = await program.account.candidate.all()
      setCandidates(allCandidates)
    } finally {
      setLoading(false)
    }
  }, [connection, wallet, publicKey, selectedPoll?.publicKey?.toBase58()])

  useEffect(() => {
    fetchResults()
    const interval = setInterval(fetchResults, 5000)
    return () => clearInterval(interval)
  }, [fetchResults])

  // Candidates for selected poll, sorted by votes (highest first)
  const pollCandidates = selectedPoll
    ? candidates
        .filter(c => c.account.poll.equals(selectedPoll.publicKey))
        .sort((a, b) => b.account.voteCount.toNumber() - a.account.voteCount.toNumber())
    : []

  return (
    <section className="page">
      <h2>Results</h2>

      {/* Poll selector */}
      {polls.length > 1 && (
        <div className="card">
          <p>Select a poll:</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {polls.map(p => (
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

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p>
            {selectedPoll
              ? <><strong>{selectedPoll.account.name}</strong> — {selectedPoll.account.isActive ? 'Voting open' : 'Voting closed'}</>
              : 'No polls created yet.'}
          </p>
          <button className="nav-btn inline" onClick={fetchResults} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        {pollCandidates.length === 0 ? (
          <p className="fine-print">No candidates yet.</p>
        ) : (
          <ul>
            {pollCandidates.map(({ account }) => (
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
