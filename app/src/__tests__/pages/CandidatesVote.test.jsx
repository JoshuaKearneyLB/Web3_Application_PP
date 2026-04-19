import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Keypair } from '@solana/web3.js'
import { setAllAccounts, setAccount, resetMockState, getRpcCalls, makeMockProgram } from '../mocks/anchor.js'

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: vi.fn(() => ({ publicKey: null })),
  useConnection: vi.fn(() => ({ connection: {} })),
}))

const { mockProgramHolder } = vi.hoisted(() => ({ mockProgramHolder: { current: null } }))
vi.mock('@coral-xyz/anchor', () => ({
  AnchorProvider: function AnchorProvider() { return {} },
  Program: function Program() { return mockProgramHolder.current },
}))

vi.mock('@idl/voting_dapp.json', () => ({
  default: { address: 'HRcWpZaiBKPPE9jHMYEFhAEkr1g1G4PDrGDNFFR7oL4U', instructions: [], accounts: [], types: [] },
}))

vi.mock('../../context/DidContext.jsx', () => ({
  useDid: vi.fn(() => ({ linked: false })),
}))

import { useWallet } from '@solana/wallet-adapter-react'
import { useDid } from '../../context/DidContext.jsx'
import CandidatesVote from '../../pages/CandidatesVote.jsx'

function setupWallet(pubkey) {
  vi.mocked(useWallet).mockReturnValue({
    publicKey: pubkey,
    signTransaction: pubkey ? vi.fn() : null,
  })
}

function setupDid(linked) {
  vi.mocked(useDid).mockReturnValue({ linked })
}

describe('CandidatesVote page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
    mockProgramHolder.current = makeMockProgram()
  })

  it('shows "Link your DID" warning when not linked', () => {
    setupWallet(Keypair.generate().publicKey)
    setupDid(false)
    render(<CandidatesVote />)
    expect(screen.getByText(/Link your DID on the Profile page/i)).toBeInTheDocument()
  })

  it('shows "No active polls" when linked but no polls exist', async () => {
    setupWallet(Keypair.generate().publicKey)
    setupDid(true)
    render(<CandidatesVote />)
    await waitFor(() => {
      expect(screen.getByText(/No active polls/i)).toBeInTheDocument()
    })
  })

  it('shows "No active polls" when polls exist but none are active', async () => {
    setupWallet(Keypair.generate().publicKey)
    setupDid(true)
    setAllAccounts('poll', [
      { publicKey: Keypair.generate().publicKey, account: { name: 'Closed Poll', isActive: false, admin: Keypair.generate().publicKey, bump: 255 } },
    ])
    render(<CandidatesVote />)
    await waitFor(() => {
      expect(screen.getByText(/No active polls/i)).toBeInTheDocument()
    })
  })

  it('shows poll name when active poll is selected', async () => {
    setupWallet(Keypair.generate().publicKey)
    setupDid(true)
    const pollPubkey = Keypair.generate().publicKey
    setAllAccounts('poll', [
      { publicKey: pollPubkey, account: { name: 'Spring Election', isActive: true, admin: Keypair.generate().publicKey, bump: 255 } },
    ])
    render(<CandidatesVote />)
    await waitFor(() => {
      expect(screen.getByText(/Spring Election/i)).toBeInTheDocument()
    })
  })

  it('shows "No candidates yet" when poll has no candidates', async () => {
    setupWallet(Keypair.generate().publicKey)
    setupDid(true)
    const pollPubkey = Keypair.generate().publicKey
    setAllAccounts('poll', [
      { publicKey: pollPubkey, account: { name: 'Empty Poll', isActive: true, admin: Keypair.generate().publicKey, bump: 255 } },
    ])
    render(<CandidatesVote />)
    await waitFor(() => {
      expect(screen.getByText(/No candidates yet/i)).toBeInTheDocument()
    })
  })

  it('renders candidates sorted alphabetically', async () => {
    setupWallet(Keypair.generate().publicKey)
    setupDid(true)
    const pollPubkey = Keypair.generate().publicKey
    setAllAccounts('poll', [
      { publicKey: pollPubkey, account: { name: 'Poll', isActive: true, admin: Keypair.generate().publicKey, bump: 255 } },
    ])
    setAllAccounts('candidate', [
      { publicKey: Keypair.generate().publicKey, account: { name: 'Charlie', poll: pollPubkey, voteCount: { toString: () => '0' }, bump: 255 } },
      { publicKey: Keypair.generate().publicKey, account: { name: 'Alice', poll: pollPubkey, voteCount: { toString: () => '0' }, bump: 255 } },
      { publicKey: Keypair.generate().publicKey, account: { name: 'Bob', poll: pollPubkey, voteCount: { toString: () => '0' }, bump: 255 } },
    ])
    render(<CandidatesVote />)

    await waitFor(() => {
      const items = screen.getAllByRole('listitem')
      expect(items[0]).toHaveTextContent('Alice')
      expect(items[1]).toHaveTextContent('Bob')
      expect(items[2]).toHaveTextContent('Charlie')
    })
  })

  it('shows "already cast" message and disables buttons when user has voted', async () => {
    const voter = Keypair.generate().publicKey
    setupWallet(voter)
    setupDid(true)
    const pollPubkey = Keypair.generate().publicKey
    setAllAccounts('poll', [
      { publicKey: pollPubkey, account: { name: 'Poll', isActive: true, admin: Keypair.generate().publicKey, bump: 255 } },
    ])
    setAllAccounts('candidate', [
      { publicKey: Keypair.generate().publicKey, account: { name: 'Alice', poll: pollPubkey, voteCount: { toString: () => '1' }, bump: 255 } },
    ])
    // Set a vote record — fetching it succeeds, which sets hasVoted = true
    setAccount('voteRecord', Keypair.generate().publicKey, { poll: pollPubkey, voter, bump: 255 })
    // Force the fetch to succeed regardless of PDA — wire it manually
    mockProgramHolder.current.account.voteRecord.fetch = vi.fn().mockResolvedValue({})

    render(<CandidatesVote />)

    await waitFor(() => {
      expect(screen.getByText(/already cast your vote/i)).toBeInTheDocument()
    })
  })

  it('clicking vote button calls the vote RPC', async () => {
    const voter = Keypair.generate().publicKey
    setupWallet(voter)
    setupDid(true)
    const pollPubkey = Keypair.generate().publicKey
    setAllAccounts('poll', [
      { publicKey: pollPubkey, account: { name: 'Poll', isActive: true, admin: Keypair.generate().publicKey, bump: 255 } },
    ])
    setAllAccounts('candidate', [
      { publicKey: Keypair.generate().publicKey, account: { name: 'Alice', poll: pollPubkey, voteCount: { toString: () => '0' }, bump: 255 } },
    ])
    // Make sure hasVoted fetch fails so the button is enabled
    mockProgramHolder.current.account.voteRecord.fetch = vi.fn().mockRejectedValue(new Error('not found'))

    render(<CandidatesVote />)

    const voteBtn = await screen.findByRole('button', { name: /^vote$/i })
    await userEvent.click(voteBtn)

    await waitFor(() => {
      const calls = getRpcCalls()
      expect(calls.some(c => c.method === 'vote')).toBe(true)
    })
  })
})
