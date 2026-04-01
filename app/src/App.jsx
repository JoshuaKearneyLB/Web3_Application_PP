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
import Resolver from './pages/Resolver.jsx'
import Connect from './pages/Connect.jsx'

// Must match ADMIN_PUBKEY in constants.rs
const ADMIN_PUBKEY = '4Dx9jxLKkqM3J7t4R3Q4G3YnzKKvKhJJn5CWVgCFrQD3'

const NAV_ITEMS = [
  { id: 'profile', label: 'Profile/DID', to: '/profile' },
  { id: 'candidates', label: 'Candidates & Vote', to: '/candidates' },
  { id: 'results', label: 'Results', to: '/results' },
  { id: 'resolver', label: 'DID Resolver', to: '/resolver' },
  { id: 'admin', label: 'Admin', to: '/admin', adminOnly: true },
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

  const isAdmin = publicKey?.toBase58() === ADMIN_PUBKEY

  const ProtectedLayout = () => {
    if (!isConnected) {
      return <Navigate to="/connect" replace />
    }

    return (
      <>
        <nav className="nav">
          {NAV_ITEMS
            .filter((item) => !item.adminOnly || isAdmin)
            .map((item) => (
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
          <Route path="/resolver" element={<Resolver />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
        <Route path="*" element={<Navigate to="/profile" replace />} />
      </Routes>
    </main>
  )
}

export default App
