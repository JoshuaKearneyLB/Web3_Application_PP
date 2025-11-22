import { useDid } from '../context/DidContext.jsx'

function CandidatesVote() {
  const { linked } = useDid()

  return (
    <section className="page">
      <h2>Candidates &amp; Vote</h2>
      <p className="page-preview">This is the Candidates &amp; Vote page.</p>
      {!linked ? (
        <div className="card">
          <p>Link your DID on the Profile page before voting.</p>
          <p className="fine-print">Voting is disabled until your DID is linked.</p>
        </div>
      ) : (
        <div className="card">
          <p>List proposals and allow eligible voters to cast a ballot here.</p>
          <ul>
            <li>
              Candidate A — <button className="nav-btn inline">Vote A</button>
            </li>
            <li>
              Candidate B — <button className="nav-btn inline">Vote B</button>
            </li>
          </ul>
          <p className="fine-print">Voting will be gated by DID/VC and on-chain registration.</p>
        </div>
      )}
    </section>
  )
}

export default CandidatesVote
