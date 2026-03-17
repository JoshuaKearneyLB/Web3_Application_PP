import { useState, useEffect, useCallback } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import idl from '@idl/voting_dapp.json'

function Results() {
  const wallet = useWallet()
  const { publicKey } = wallet
  const { connection } = useConnection()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchResults = useCallback(async () => {
    if (!publicKey) return
    setLoading(true)
    try {
      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
      const program = new Program(idl, provider)
      const all = await program.account.candidate.all()
      // Sort highest votes first
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
          <p>Live vote counts.</p>
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
