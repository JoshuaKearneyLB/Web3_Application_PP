import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Keypair } from '@solana/web3.js'
import { setAllAccounts, resetMockState, makeMockProgram } from '../mocks/anchor.js'

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

import { useWallet } from '@solana/wallet-adapter-react'
import Results from '../../pages/Results.jsx'

function setupWallet(pubkey) {
  vi.mocked(useWallet).mockReturnValue({
    publicKey: pubkey,
    signTransaction: pubkey ? vi.fn() : null,
  })
}

describe('Results page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
    mockProgramHolder.current = makeMockProgram()
  })

  it('shows "No polls created yet" when no polls exist', async () => {
    setupWallet(Keypair.generate().publicKey)
    render(<Results />)
    await waitFor(() => {
      expect(screen.getByText(/No polls created yet/i)).toBeInTheDocument()
    })
  })

  it('shows poll name when a poll is auto-selected', async () => {
    setupWallet(Keypair.generate().publicKey)
    const pollPubkey = Keypair.generate().publicKey
    setAllAccounts('poll', [
      { publicKey: pollPubkey, account: { name: 'Autumn Election', isActive: true, admin: Keypair.generate().publicKey, bump: 255 } },
    ])
    render(<Results />)
    await waitFor(() => {
      expect(screen.getByText(/Autumn Election/i)).toBeInTheDocument()
    })
  })

  it('shows "Voting open" when poll is active', async () => {
    setupWallet(Keypair.generate().publicKey)
    setAllAccounts('poll', [
      { publicKey: Keypair.generate().publicKey, account: { name: 'Poll', isActive: true, admin: Keypair.generate().publicKey, bump: 255 } },
    ])
    render(<Results />)
    await waitFor(() => {
      expect(screen.getByText(/Voting open/i)).toBeInTheDocument()
    })
  })

  it('shows "Voting closed" when poll is inactive', async () => {
    setupWallet(Keypair.generate().publicKey)
    setAllAccounts('poll', [
      { publicKey: Keypair.generate().publicKey, account: { name: 'Poll', isActive: false, admin: Keypair.generate().publicKey, bump: 255 } },
    ])
    render(<Results />)
    await waitFor(() => {
      expect(screen.getByText(/Voting closed/i)).toBeInTheDocument()
    })
  })

  it('renders candidates sorted by vote count descending', async () => {
    setupWallet(Keypair.generate().publicKey)
    const pollPubkey = Keypair.generate().publicKey
    setAllAccounts('poll', [
      { publicKey: pollPubkey, account: { name: 'Poll', isActive: true, admin: Keypair.generate().publicKey, bump: 255 } },
    ])
    setAllAccounts('candidate', [
      { publicKey: Keypair.generate().publicKey, account: { name: 'Alice', poll: pollPubkey, voteCount: { toNumber: () => 5, toString: () => '5' }, bump: 255 } },
      { publicKey: Keypair.generate().publicKey, account: { name: 'Bob', poll: pollPubkey, voteCount: { toNumber: () => 12, toString: () => '12' }, bump: 255 } },
      { publicKey: Keypair.generate().publicKey, account: { name: 'Charlie', poll: pollPubkey, voteCount: { toNumber: () => 8, toString: () => '8' }, bump: 255 } },
    ])
    render(<Results />)

    await waitFor(() => {
      const items = screen.getAllByRole('listitem')
      expect(items[0]).toHaveTextContent('Bob')
      expect(items[1]).toHaveTextContent('Charlie')
      expect(items[2]).toHaveTextContent('Alice')
    })
  })

  it('shows poll selector when multiple polls exist', async () => {
    setupWallet(Keypair.generate().publicKey)
    setAllAccounts('poll', [
      { publicKey: Keypair.generate().publicKey, account: { name: 'Poll A', isActive: true, admin: Keypair.generate().publicKey, bump: 255 } },
      { publicKey: Keypair.generate().publicKey, account: { name: 'Poll B', isActive: false, admin: Keypair.generate().publicKey, bump: 255 } },
    ])
    render(<Results />)
    await waitFor(() => {
      expect(screen.getByText(/Select a poll/i)).toBeInTheDocument()
    })
  })

  it('refresh button triggers a refetch', async () => {
    setupWallet(Keypair.generate().publicKey)
    const fetchAllSpy = mockProgramHolder.current.account.poll.all
    render(<Results />)

    // Wait for first fetch to complete (no polls message appears)
    await screen.findByText(/No polls created yet/i)
    const callsBefore = fetchAllSpy.mock.calls.length

    const refreshBtn = screen.getByRole('button')
    await userEvent.click(refreshBtn)

    await waitFor(() => {
      expect(fetchAllSpy.mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })
})
