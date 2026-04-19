import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Keypair, PublicKey } from '@solana/web3.js'
import { setAccount, resetMockState, makeMockProgram } from '../mocks/anchor.js'

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
import Resolver from '../../pages/Resolver.jsx'

function setupWallet(pubkey) {
  vi.mocked(useWallet).mockReturnValue({
    publicKey: pubkey,
    signTransaction: pubkey ? vi.fn() : null,
  })
}

describe('Resolver page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
    mockProgramHolder.current = makeMockProgram()
  })

  it('renders the resolve input and button', () => {
    setupWallet(Keypair.generate().publicKey)
    render(<Resolver />)
    expect(screen.getByPlaceholderText(/did:sol:/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resolve/i })).toBeInTheDocument()
  })

  it('resolve button disabled when input is empty', () => {
    setupWallet(Keypair.generate().publicKey)
    render(<Resolver />)
    expect(screen.getByRole('button', { name: /resolve/i })).toBeDisabled()
  })

  it('resolve button enabled when input has text', async () => {
    setupWallet(Keypair.generate().publicKey)
    render(<Resolver />)
    await userEvent.type(screen.getByPlaceholderText(/did:sol:/i), 'did:sol:abc')
    expect(screen.getByRole('button', { name: /resolve/i })).toBeEnabled()
  })

  it('shows error on invalid DID format', async () => {
    setupWallet(Keypair.generate().publicKey)
    render(<Resolver />)
    await userEvent.type(screen.getByPlaceholderText(/did:sol:/i), 'invalid-pubkey-junk')
    await userEvent.click(screen.getByRole('button', { name: /resolve/i }))
    await waitFor(() => {
      expect(screen.getByText(/Invalid DID or wallet address/i)).toBeInTheDocument()
    })
  })

  it('shows "Not registered" when voter PDA does not exist', async () => {
    setupWallet(Keypair.generate().publicKey)
    const targetPubkey = Keypair.generate().publicKey
    // Both fetches return rejections (no accounts)
    render(<Resolver />)
    await userEvent.type(screen.getByPlaceholderText(/did:sol:/i), `did:sol:${targetPubkey.toBase58()}`)
    await userEvent.click(screen.getByRole('button', { name: /resolve/i }))
    await waitFor(() => {
      expect(screen.getByText(/Not registered/i)).toBeInTheDocument()
    })
  })

  it('displays voter data when DID is registered', async () => {
    setupWallet(Keypair.generate().publicKey)
    const targetPubkey = Keypair.generate().publicKey
    const programId = mockProgramHolder.current.programId
    const [voterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('anchor'), targetPubkey.toBuffer()],
      programId,
    )
    setAccount('voter', voterPda, {
      authority: targetPubkey,
      did: `did:sol:${targetPubkey.toBase58()}`,
      docUri: 'http://localhost:5173/did.json',
      docHash: new Uint8Array(32).fill(0xaa),
      hasVoted: false,
      bump: 255,
    })

    render(<Resolver />)
    await userEvent.type(screen.getByPlaceholderText(/did:sol:/i), `did:sol:${targetPubkey.toBase58()}`)
    await userEvent.click(screen.getByRole('button', { name: /resolve/i }))

    await waitFor(() => {
      expect(screen.getByText(/Registered/i)).toBeInTheDocument()
    })
  })

  it('accepts raw pubkey (without did:sol: prefix)', async () => {
    setupWallet(Keypair.generate().publicKey)
    const targetPubkey = Keypair.generate().publicKey

    render(<Resolver />)
    await userEvent.type(screen.getByPlaceholderText(/did:sol:/i), targetPubkey.toBase58())
    await userEvent.click(screen.getByRole('button', { name: /resolve/i }))

    await waitFor(() => {
      // Should display the constructed DID with the pubkey
      expect(screen.getByText(new RegExp(`did:sol:${targetPubkey.toBase58()}`))).toBeInTheDocument()
    })
  })
})
