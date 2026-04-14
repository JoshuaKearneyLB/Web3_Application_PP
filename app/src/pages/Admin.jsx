import { useState, useEffect, useCallback } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import idl from '@idl/voting_dapp.json'

// Must match ADMIN_PUBKEY in constants.rs
const ADMIN_PUBKEY = '4Dx9jxLKkqM3J7t4R3Q4G3YnzKKvKhJJn5CWVgCFrQD3'
const ADMIN_SALT_KEY = 'admin_identity_salt'

function getAdminSalt() {
  let salt = localStorage.getItem(ADMIN_SALT_KEY)
  if (!salt) {
    const arr = new Uint8Array(32)
    crypto.getRandomValues(arr)
    salt = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
    localStorage.setItem(ADMIN_SALT_KEY, salt)
  }
  return salt
}

function Admin() {
  const wallet = useWallet()
  const { publicKey } = wallet
  const { connection } = useConnection()
  const [polls, setPolls] = useState([])
  const [selectedPoll, setSelectedPoll] = useState(null) // { publicKey, account }
  const [pollName, setPollName] = useState('')
  const [candidateName, setCandidateName] = useState('')
  const [credentialTarget, setCredentialTarget] = useState('')
  const [studentId, setStudentId] = useState('')
  const [candidates, setCandidates] = useState([])
  const [credentials, setCredentials] = useState([])
  const [voters, setVoters] = useState([])
  const [credentialSearch, setCredentialSearch] = useState('')
  const [voterSearch, setVoterSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [feedback, setFeedback] = useState('')

  const filteredCredentials = credentials.filter(c =>
    c.account.subject.toBase58().toLowerCase().includes(credentialSearch.toLowerCase())
  )
  const filteredVoters = voters.filter(v =>
    v.account.authority.toBase58().toLowerCase().includes(voterSearch.toLowerCase())
  )

  const isAdmin = publicKey?.toBase58() === ADMIN_PUBKEY

  const buildProgram = useCallback(() => {
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
    return new Program(idl, provider)
  }, [connection, wallet])

  const fetchData = useCallback(async () => {
    if (!publicKey) return
    const program = buildProgram()

    // Fetch all polls
    const allPolls = await program.account.poll.all()
    setPolls(allPolls)

    // Fetch all candidates
    const allCandidates = await program.account.candidate.all()
    setCandidates(allCandidates)

    // Fetch all credentials
    const allCredentials = await program.account.credential.all()
    setCredentials(allCredentials)

    // Fetch all registered voters
    const allVoters = await program.account.voter.all()
    setVoters(allVoters)

    // Update selected poll if it still exists
    if (selectedPoll) {
      const still = allPolls.find(p => p.publicKey.equals(selectedPoll.publicKey))
      setSelectedPoll(still || null)
    }
  }, [publicKey, buildProgram])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Candidates for the selected poll
  const pollCandidates = selectedPoll
    ? candidates.filter(c => c.account.poll.equals(selectedPoll.publicKey)).sort((a, b) => a.account.name.localeCompare(b.account.name))
    : []

  // Create a new poll
  const handleCreatePoll = async () => {
    if (!pollName.trim()) return
    setLoading(true)
    setError(null)
    setFeedback('')
    try {
      const program = buildProgram()
      const trimmed = pollName.trim()
      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('poll'), Buffer.from(trimmed)],
        program.programId,
      )
      await program.methods
        .createPoll(trimmed)
        .accounts({
          poll: pollPda,
          authority: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
      setFeedback(`Poll "${trimmed}" created.`)
      setPollName('')
      await fetchData()
    } catch (err) {
      setError(err.message || 'Failed to create poll')
    } finally {
      setLoading(false)
    }
  }

  // Toggle voting on selected poll
  const handleToggleVoting = async () => {
    if (!selectedPoll) return
    setLoading(true)
    setError(null)
    setFeedback('')
    try {
      const program = buildProgram()
      await program.methods
        .toggleVoting()
        .accounts({
          poll: selectedPoll.publicKey,
          admin: publicKey,
        })
        .rpc()
      setFeedback(selectedPoll.account.isActive ? 'Voting closed.' : 'Voting opened.')
      await fetchData()
    } catch (err) {
      setError(err.message || 'Failed to toggle voting')
    } finally {
      setLoading(false)
    }
  }

  // Add a candidate to the selected poll
  const handleCreateCandidate = async () => {
    if (!candidateName.trim() || !selectedPoll) return
    setLoading(true)
    setError(null)
    setFeedback('')
    try {
      const program = buildProgram()
      const trimmed = candidateName.trim()
      const [candidatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('candidate'), selectedPoll.publicKey.toBuffer(), Buffer.from(trimmed)],
        program.programId,
      )
      await program.methods
        .createCandidate(trimmed)
        .accounts({
          poll: selectedPoll.publicKey,
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

  // Delete selected poll (close candidates first, then poll)
  const handleDeletePoll = async () => {
    if (!selectedPoll || selectedPoll.account.isActive) return
    setLoading(true)
    setError(null)
    setFeedback('')
    try {
      const program = buildProgram()

      // Close each candidate belonging to this poll
      for (const c of pollCandidates) {
        await program.methods
          .closeCandidate()
          .accounts({
            poll: selectedPoll.publicKey,
            candidate: c.publicKey,
            admin: publicKey,
          })
          .rpc()
      }

      // Close the poll itself
      await program.methods
        .closePoll()
        .accounts({
          poll: selectedPoll.publicKey,
          admin: publicKey,
        })
        .rpc()

      setFeedback('Poll deleted.')
      setSelectedPoll(null)
      await fetchData()
    } catch (err) {
      setError(err.message || 'Failed to delete poll')
    } finally {
      setLoading(false)
    }
  }

  // Issue a credential
  const handleIssueCredential = async () => {
    if (!credentialTarget.trim() || !studentId.trim()) return
    setLoading(true)
    setError(null)
    setFeedback('')
    try {
      const program = buildProgram()
      const subjectPubkey = new PublicKey(credentialTarget.trim())

      const vcJson = JSON.stringify({
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'VoterEligibilityCredential'],
        issuer: `did:sol:${publicKey.toBase58()}`,
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: `did:sol:${subjectPubkey.toBase58()}`,
          eligibility: { type: 'VoterEligibility', eligible: true, reason: 'Verified by election administrator' },
        },
      })

      const credentialHash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(vcJson)))
      const salt = getAdminSalt()
      const identityHash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(studentId.trim() + salt)))

      const [credentialPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('credential'), subjectPubkey.toBuffer()],
        program.programId,
      )
      const [identityPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('identity'), identityHash],
        program.programId,
      )

      await program.methods
        .issueCredential(credentialHash, identityHash)
        .accounts({
          credential: credentialPda,
          identity: identityPda,
          subject: subjectPubkey,
          admin: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      setFeedback(`Credential issued to ${subjectPubkey.toBase58().slice(0, 8)}…`)
      setCredentialTarget('')
      setStudentId('')
      await fetchData()
    } catch (err) {
      if (err.message?.includes('already in use')) {
        setError('This identity has already been issued a credential.')
      } else {
        setError(err.message || 'Failed to issue credential')
      }
    } finally {
      setLoading(false)
    }
  }

  // Revoke a credential
  const handleRevoke = async (subjectPubkey) => {
    setLoading(true)
    setError(null)
    setFeedback('')
    try {
      const program = buildProgram()
      const [credentialPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('credential'), new PublicKey(subjectPubkey).toBuffer()],
        program.programId,
      )
      await program.methods
        .revokeCredential()
        .accounts({ credential: credentialPda, issuer: publicKey })
        .rpc()
      setFeedback('Credential revoked.')
      await fetchData()
    } catch (err) {
      setError(err.message || 'Failed to revoke credential')
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

      {/* Create new poll */}
      <div className="card">
        <p>Create a new poll.</p>
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

      {/* Poll list */}
      {polls.length > 0 && (
        <div className="card">
          <p>Polls on-chain:</p>
          <ul>
            {polls.map((p) => (
              <li key={p.publicKey.toBase58()} style={{ marginBottom: '0.4rem' }}>
                <button
                  className="nav-btn inline"
                  onClick={() => setSelectedPoll(p)}
                  style={{ fontWeight: selectedPoll?.publicKey.equals(p.publicKey) ? 'bold' : 'normal' }}
                >
                  {p.account.name}
                </button>
                {' '}<span className="fine-print">({p.account.isActive ? 'Open' : 'Closed'})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Selected poll management */}
      {selectedPoll && (
        <>
          <div className="card">
            <p>Managing: <strong>{selectedPoll.account.name}</strong></p>
            <p className="fine-print">
              Voting is currently <strong>{selectedPoll.account.isActive ? 'OPEN' : 'CLOSED'}</strong>
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button className="nav-btn inline" onClick={handleToggleVoting} disabled={loading}>
                {loading ? 'Updating…' : selectedPoll.account.isActive ? 'Close Voting' : 'Open Voting'}
              </button>
              {!selectedPoll.account.isActive && (
                <button className="nav-btn inline" onClick={handleDeletePoll} disabled={loading} style={{ color: 'red' }}>
                  {loading ? 'Deleting…' : 'Delete Poll'}
                </button>
              )}
            </div>
          </div>

          {/* Add candidate to selected poll */}
          <div className="card">
            <p>Add candidates to "{selectedPoll.account.name}".</p>
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

          {/* Candidates for this poll */}
          {pollCandidates.length > 0 && (
            <div className="card">
              <p>Candidates in "{selectedPoll.account.name}":</p>
              <ul>
                {pollCandidates.map(({ account }) => (
                  <li key={account.name}>
                    {account.name} — {account.voteCount.toString()} votes
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Issue credential form (global, not per-poll) */}
      <div className="card">
        <p>Issue voter credentials.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
          <input
            type="text"
            value={credentialTarget}
            onChange={e => setCredentialTarget(e.target.value)}
            placeholder="Voter wallet address"
            style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleIssueCredential()}
              placeholder="Unique ID (e.g. student number)"
              style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #ccc', flex: 1 }}
            />
            <button className="nav-btn inline" onClick={handleIssueCredential} disabled={!credentialTarget.trim() || !studentId.trim() || loading}>
              {loading ? 'Issuing…' : 'Issue Credential'}
            </button>
          </div>
        </div>
      </div>

      {feedback && <p className="fine-print">{feedback}</p>}
      {error && <p className="fine-print" style={{ color: 'red' }}>{error}</p>}

      {/* Issued credentials list */}
      {credentials.length > 0 && (
        <div className="card">
          <p>Issued credentials ({filteredCredentials.length}/{credentials.length}):</p>
          <input
            type="text"
            placeholder="Search by wallet address..."
            value={credentialSearch}
            onChange={e => setCredentialSearch(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #ccc', width: '100%', marginBottom: '0.5rem' }}
          />
          <ul>
            {filteredCredentials.map(({ account }) => (
              <li key={account.subject.toBase58()} style={{ marginBottom: '0.4rem' }}>
                <code style={{ fontSize: '0.8rem' }}>{account.subject.toBase58()}</code> — {account.isRevoked ? (
                  <span style={{ color: 'red' }}>Revoked</span>
                ) : (
                  <>
                    <span style={{ color: 'green' }}>Active</span>
                    {' '}
                    <button className="nav-btn inline" onClick={() => handleRevoke(account.subject.toBase58())} disabled={loading} style={{ fontSize: '0.75rem' }}>
                      Revoke
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Registered voters list */}
      {voters.length > 0 && (
        <div className="card">
          <p>Registered voters ({filteredVoters.length}/{voters.length}):</p>
          <input
            type="text"
            placeholder="Search by wallet address..."
            value={voterSearch}
            onChange={e => setVoterSearch(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #ccc', width: '100%', marginBottom: '0.5rem' }}
          />
          <ul>
            {filteredVoters.map(({ account }) => (
              <li key={account.authority.toBase58()} style={{ marginBottom: '0.4rem' }}>
                <code style={{ fontSize: '0.8rem' }}>{account.authority.toBase58()}</code>
                {' — '}
                <span className="fine-print">{account.did}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default Admin
