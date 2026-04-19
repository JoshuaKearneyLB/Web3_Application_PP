import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createContext } from 'react'
import { PublicKey } from '@solana/web3.js'

// Mock wallet adapter before importing Profile
vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: vi.fn(),
  useConnection: vi.fn(() => ({ connection: {} })),
}))

// Mock the DidContext — we'll override the useDid hook per test
const mockDidValue = {
  did: null,
  linked: false,
  linkDid: vi.fn(),
  didDocument: null,
  credential: null,
  hasCredential: false,
  loading: false,
  error: null,
}

vi.mock('../../context/DidContext.jsx', () => ({
  useDid: vi.fn(() => mockDidValue),
  DidProvider: ({ children }) => children,
}))

import { useWallet } from '@solana/wallet-adapter-react'
import { useDid } from '../../context/DidContext.jsx'
import Profile from '../../pages/Profile.jsx'

function setupDid(overrides = {}) {
  const value = { ...mockDidValue, linkDid: vi.fn().mockResolvedValue(true), ...overrides }
  vi.mocked(useDid).mockReturnValue(value)
  return value
}

function setupWallet(pubkey = null) {
  vi.mocked(useWallet).mockReturnValue({
    publicKey: pubkey,
    signTransaction: pubkey ? vi.fn() : null,
  })
}

describe('Profile page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows "Connect wallet to derive DID" when no wallet is connected', () => {
    setupWallet(null)
    setupDid({ did: null })
    render(<Profile />)
    expect(screen.getByText(/Connect wallet to derive DID/i)).toBeInTheDocument()
  })

  it('shows "No credential issued" when no credential is available', () => {
    const pubkey = PublicKey.unique()
    setupWallet(pubkey)
    setupDid({ did: `did:sol:${pubkey.toBase58()}`, credential: null, hasCredential: false })
    render(<Profile />)
    expect(screen.getByText(/No credential issued/i)).toBeInTheDocument()
  })

  it('link button is disabled when no credential', () => {
    const pubkey = PublicKey.unique()
    setupWallet(pubkey)
    setupDid({ did: `did:sol:${pubkey.toBase58()}`, hasCredential: false })
    render(<Profile />)
    expect(screen.getByRole('button', { name: /link did/i })).toBeDisabled()
  })

  it('shows "Credential: Valid" when credential is present and not revoked', () => {
    const pubkey = PublicKey.unique()
    const issuer = PublicKey.unique()
    setupWallet(pubkey)
    setupDid({
      did: `did:sol:${pubkey.toBase58()}`,
      credential: {
        issuer,
        isRevoked: false,
        issuedAt: { toNumber: () => 1700000000 },
      },
      hasCredential: true,
    })
    render(<Profile />)
    expect(screen.getByText(/Credential: Valid/i)).toBeInTheDocument()
  })

  it('shows "Credential: Revoked" in red when credential is revoked', () => {
    const pubkey = PublicKey.unique()
    setupWallet(pubkey)
    setupDid({
      did: `did:sol:${pubkey.toBase58()}`,
      credential: {
        issuer: PublicKey.unique(),
        isRevoked: true,
        issuedAt: { toNumber: () => 1700000000 },
      },
      hasCredential: true,
    })
    render(<Profile />)
    expect(screen.getByText(/Credential: Revoked/i)).toBeInTheDocument()
  })

  it('link button enabled when hasCredential and not linked', () => {
    const pubkey = PublicKey.unique()
    setupWallet(pubkey)
    setupDid({
      did: `did:sol:${pubkey.toBase58()}`,
      credential: { issuer: PublicKey.unique(), isRevoked: false, issuedAt: { toNumber: () => 1700000000 } },
      hasCredential: true,
      linked: false,
    })
    render(<Profile />)
    expect(screen.getByRole('button', { name: /link did/i })).toBeEnabled()
  })

  it('button shows "Signing…" when loading', () => {
    const pubkey = PublicKey.unique()
    setupWallet(pubkey)
    setupDid({
      did: `did:sol:${pubkey.toBase58()}`,
      hasCredential: true,
      loading: true,
    })
    render(<Profile />)
    expect(screen.getByRole('button', { name: /signing…/i })).toBeDisabled()
  })

  it('button shows "DID Linked" when already linked', () => {
    const pubkey = PublicKey.unique()
    setupWallet(pubkey)
    setupDid({
      did: `did:sol:${pubkey.toBase58()}`,
      hasCredential: true,
      linked: true,
    })
    render(<Profile />)
    expect(screen.getByRole('button', { name: /did linked/i })).toBeDisabled()
  })

  it('renders DID document JSON when linked', () => {
    const pubkey = PublicKey.unique()
    const didDocument = { id: `did:sol:${pubkey.toBase58()}`, verificationMethod: [] }
    setupWallet(pubkey)
    setupDid({
      did: `did:sol:${pubkey.toBase58()}`,
      hasCredential: true,
      linked: true,
      didDocument,
    })
    render(<Profile />)
    expect(screen.getByText(/DID document \(with embedded/i)).toBeInTheDocument()
  })

  it('shows feedback message after successful link', async () => {
    const pubkey = PublicKey.unique()
    const linkDid = vi.fn().mockResolvedValue(true)
    setupWallet(pubkey)
    setupDid({
      did: `did:sol:${pubkey.toBase58()}`,
      hasCredential: true,
      linkDid,
    })
    render(<Profile />)

    await userEvent.click(screen.getByRole('button', { name: /link did/i }))

    expect(linkDid).toHaveBeenCalled()
    expect(await screen.findByText(/DID linked and registered on-chain/i)).toBeInTheDocument()
  })

  it('shows error message in red if linkDid sets an error', () => {
    const pubkey = PublicKey.unique()
    setupWallet(pubkey)
    setupDid({
      did: `did:sol:${pubkey.toBase58()}`,
      hasCredential: true,
      error: 'Something went wrong',
    })
    render(<Profile />)
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument()
  })
})
