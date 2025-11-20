function CandidatesVote() {
  return (
    <section className="page">
      <h2>Candidates &amp; Vote</h2>
      <p className="page-preview">This is the Candidates &amp; Vote page.</p>
      <div className="card">
        <p>List proposals and allow eligible voters to cast a ballot here.</p>
        <ul>
          <li>Candidate A — <button className="nav-btn inline">Vote A</button></li>
          <li>Candidate B — <button className="nav-btn inline">Vote B</button></li>
        </ul>
        <p className="fine-print">Voting will be gated by DID/VC and on-chain registration.</p>
      </div>
    </section>
  )
}

export default CandidatesVote
