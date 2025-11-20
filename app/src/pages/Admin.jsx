function Admin() {
  return (
    <section className="page">
      <h2>Admin</h2>
      <p className="page-preview">This is the Admin page.</p>
      <div className="card">
        <p>Manage proposals, voting windows, and VC issuance here.</p>
        <ul>
          <li>Create/edit proposals</li>
          <li>Open/close voting</li>
          <li>Issue or upload fake VCs</li>
        </ul>
      </div>
    </section>
  )
}

export default Admin
