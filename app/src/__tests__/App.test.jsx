import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Keypair, PublicKey } from '@solana/web3.js'

const ADMIN_PUBKEY = new PublicKey('4Dx9jxLKkqM3J7t4R3Q4G3YnzKKvKhJJn5CWVgCFrQD3')

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: vi.fn(() => ({ publicKey: null })),
  useConnection: vi.fn(() => ({ connection: {} })),
}))

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  WalletMultiButton: () => <div data-testid="wallet-button">Connect Wallet</div>,
}))

// Mock page components to avoid rendering their full tree.
// Paths match App.jsx's imports ("./pages/X.jsx") — vi.mock resolves by module ID.
vi.mock('../pages/Connect.jsx', () => ({
  default: () => <div>Connect Page Stub</div>,
}))
vi.mock('../pages/Profile.jsx', () => ({
  default: () => <div>Profile Page Stub</div>,
}))
vi.mock('../pages/CandidatesVote.jsx', () => ({
  default: () => <div>CandidatesVote Page Stub</div>,
}))
vi.mock('../pages/Results.jsx', () => ({
  default: () => <div>Results Page Stub</div>,
}))
vi.mock('../pages/Admin.jsx', () => ({
  default: () => <div>Admin Page Stub</div>,
}))
vi.mock('../pages/Resolver.jsx', () => ({
  default: () => <div>Resolver Page Stub</div>,
}))

import { useWallet } from '@solana/wallet-adapter-react'
import App from '../App.jsx'

function setupWallet(pubkey) {
  vi.mocked(useWallet).mockReturnValue({
    publicKey: pubkey,
    signTransaction: pubkey ? vi.fn() : null,
  })
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  )
}

describe('App router and auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('/connect route shows Connect page when not authenticated', () => {
    setupWallet(null)
    renderAt('/connect')
    expect(screen.getByText('Connect Page Stub')).toBeInTheDocument()
  })

  it('/profile redirects to /connect when not authenticated', () => {
    setupWallet(null)
    renderAt('/profile')
    expect(screen.getByText('Connect Page Stub')).toBeInTheDocument()
    expect(screen.queryByText('Profile Page Stub')).not.toBeInTheDocument()
  })

  it('/admin redirects to /connect when not authenticated', () => {
    setupWallet(null)
    renderAt('/admin')
    expect(screen.getByText('Connect Page Stub')).toBeInTheDocument()
    expect(screen.queryByText('Admin Page Stub')).not.toBeInTheDocument()
  })

  it('/candidates redirects to /connect when not authenticated', () => {
    setupWallet(null)
    renderAt('/candidates')
    expect(screen.getByText('Connect Page Stub')).toBeInTheDocument()
    expect(screen.queryByText('CandidatesVote Page Stub')).not.toBeInTheDocument()
  })

  it('/profile renders Profile page when authenticated', () => {
    setupWallet(Keypair.generate().publicKey)
    renderAt('/profile')
    expect(screen.getByText('Profile Page Stub')).toBeInTheDocument()
  })

  it('Admin nav link hidden for non-admin wallets', () => {
    setupWallet(Keypair.generate().publicKey)
    renderAt('/profile')
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument()
  })

  it('Admin nav link visible for admin wallet', () => {
    setupWallet(ADMIN_PUBKEY)
    renderAt('/profile')
    expect(screen.getByRole('link', { name: /admin/i })).toBeInTheDocument()
  })

  it('renders the Voting DApp heading and wallet button', () => {
    setupWallet(null)
    renderAt('/connect')
    expect(screen.getByRole('heading', { name: /voting dapp/i })).toBeInTheDocument()
    expect(screen.getByTestId('wallet-button')).toBeInTheDocument()
  })
})
