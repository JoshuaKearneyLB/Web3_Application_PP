import './App.css'
import { useEffect } from 'react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useWallet } from '@solana/wallet-adapter-react'
import {
  NavLink,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import Profile from './pages/Profile.jsx'
import CandidatesVote from './pages/CandidatesVote.jsx'
import Results from './pages/Results.jsx'
import Admin from './pages/Admin.jsx'
import Connect from './pages/Connect.jsx'

const NAV_ITEMS = [
  { id: 'profile', label: 'Profile/DID', to: '/profile' },
  { id: 'candidates', label: 'Candidates & Vote', to: '/candidates' },
  { id: 'results', label: 'Results', to: '/results' },
  { id: 'admin', label: 'Admin', to: '/admin' },
]

function App() {
  const { publicKey } = useWallet()
  const isConnected = Boolean(publicKey)
  const location = useLocation()
  const navigate = useNavigate()

  // If user is on the connect page and connects, send them to profile automatically.
  useEffect(() => {
    if (isConnected && location.pathname === '/connect') {
      navigate('/profile', { replace: true })
    }
  }, [isConnected, location.pathname, navigate])

  const ProtectedLayout = () => {
    if (!isConnected) {
      return <Navigate to="/connect" replace />
    }

    return (
      <>
        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.id}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-btn active' : 'nav-btn')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Outlet />
      </>
    )
  }

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>Voting DApp</h1>
          <p className="subtitle">
            Connect a wallet and navigate between the app sections.
          </p>
        </div>
        <WalletMultiButton />
      </header>

      <Routes>
        <Route path="/connect" element={<Connect />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Navigate to="/profile" replace />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/candidates" element={<CandidatesVote />} />
          <Route path="/results" element={<Results />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
        <Route path="*" element={<Navigate to="/profile" replace />} />
      </Routes>
    </main>
  )
}

export default App
