function Results() {
  return (
    <section className="page">
      <h2>Results</h2>
      <p className="page-preview">This is the Results page.</p>
      <div className="card">
        <p>Live counts and turnout will appear here.</p>
        <ul>
          <li>Candidate A: 0 votes</li>
          <li>Candidate B: 0 votes</li>
        </ul>
        <p className="fine-print">Auto-refresh will keep tallies current.</p>
      </div>
    </section>
  )
}

export default Results
