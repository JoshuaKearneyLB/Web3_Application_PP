import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Keypair, PublicKey } from '@solana/web3.js'
import { setAccount, resetMockState, makeMockProgram } from '../mocks/anchor.js'

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: vi.fn(() => ({ publicKey: null, signTransaction: null })),
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
import { DidProvider, useDid } from '../../context/DidContext.jsx'

function setupWallet(pubkey) {
  vi.mocked(useWallet).mockReturnValue({
    publicKey: pubkey,
    signTransaction: pubkey ? vi.fn() : null,
    signAllTransactions: pubkey ? vi.fn() : null,
  })
}

// Test component that renders context values for inspection
function TestConsumer() {
  const ctx = useDid()
  return (
    <div>
      <div data-testid="did">{ctx.did || 'null'}</div>
      <div data-testid="linked">{String(ctx.linked)}</div>
      <div data-testid="hasCredential">{String(ctx.hasCredential)}</div>
      <div data-testid="loading">{String(ctx.loading)}</div>
      <div data-testid="error">{ctx.error || 'null'}</div>
      <div data-testid="credential">{ctx.credential ? 'present' : 'null'}</div>
      <button onClick={() => ctx.linkDid()} data-testid="link-btn">link</button>
    </div>
  )
}

describe('DidContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
    mockProgramHolder.current = makeMockProgram()
  })

  it('did is null when no wallet connected', () => {
    setupWallet(null)
    render(<DidProvider><TestConsumer /></DidProvider>)
    expect(screen.getByTestId('did')).toHaveTextContent('null')
    expect(screen.getByTestId('linked')).toHaveTextContent('false')
  })

  it('did becomes did:sol:<pubkey> when wallet connects', () => {
    const pubkey = Keypair.generate().publicKey
    setupWallet(pubkey)
    render(<DidProvider><TestConsumer /></DidProvider>)
    expect(screen.getByTestId('did')).toHaveTextContent(`did:sol:${pubkey.toBase58()}`)
  })

  it('hasCredential is false when no credential exists on chain', async () => {
    const pubkey = Keypair.generate().publicKey
    setupWallet(pubkey)
    render(<DidProvider><TestConsumer /></DidProvider>)
    await waitFor(() => {
      expect(screen.getByTestId('credential')).toHaveTextContent('null')
    })
    expect(screen.getByTestId('hasCredential')).toHaveTextContent('false')
  })

  it('credential populated when credential PDA exists', async () => {
    const pubkey = Keypair.generate().publicKey
    const programId = mockProgramHolder.current.programId
    const [credentialPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('credential'), pubkey.toBuffer()],
      programId,
    )
    setAccount('credential', credentialPda, {
      issuer: Keypair.generate().publicKey,
      subject: pubkey,
      isRevoked: false,
      issuedAt: { toNumber: () => 1700000000 },
      bump: 255,
    })
    setupWallet(pubkey)

    render(<DidProvider><TestConsumer /></DidProvider>)
    await waitFor(() => {
      expect(screen.getByTestId('credential')).toHaveTextContent('present')
    })
    expect(screen.getByTestId('hasCredential')).toHaveTextContent('true')
  })

  it('linkDid returns false when no credential', async () => {
    const pubkey = Keypair.generate().publicKey
    setupWallet(pubkey)
    render(<DidProvider><TestConsumer /></DidProvider>)
    await userEvent.click(screen.getByTestId('link-btn'))
    // linkDid short-circuits with !hasCredential — no error set
    expect(screen.getByTestId('error')).toHaveTextContent('null')
    expect(screen.getByTestId('linked')).toHaveTextContent('false')
  })

  it('clears state when wallet disconnects', async () => {
    const pubkey = Keypair.generate().publicKey
    setupWallet(pubkey)
    const { rerender } = render(<DidProvider><TestConsumer /></DidProvider>)
    await waitFor(() => {
      expect(screen.getByTestId('did')).toHaveTextContent(`did:sol:${pubkey.toBase58()}`)
    })

    // Disconnect
    setupWallet(null)
    rerender(<DidProvider><TestConsumer /></DidProvider>)
    await waitFor(() => {
      expect(screen.getByTestId('did')).toHaveTextContent('null')
    })
  })

  it('useDid throws when used outside DidProvider', () => {
    // Silence React's error boundary console output
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer />)).toThrow('useDid must be used within a DidProvider')
    errorSpy.mockRestore()
  })

  it('removes stale localStorage entry when voter PDA does not exist on chain', async () => {
    const pubkey = Keypair.generate().publicKey
    const storageKey = `did_doc_${pubkey.toBase58()}`
    localStorage.setItem(storageKey, JSON.stringify({ id: 'stale-doc' }))

    setupWallet(pubkey)
    render(<DidProvider><TestConsumer /></DidProvider>)

    await waitFor(() => {
      expect(localStorage.getItem(storageKey)).toBeNull()
    })
  })

  it('restores linked state when voter PDA exists and localStorage has doc', async () => {
    const pubkey = Keypair.generate().publicKey
    const storageKey = `did_doc_${pubkey.toBase58()}`
    localStorage.setItem(storageKey, JSON.stringify({ id: `did:sol:${pubkey.toBase58()}` }))

    const programId = mockProgramHolder.current.programId
    const [voterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('anchor'), pubkey.toBuffer()],
      programId,
    )
    setAccount('voter', voterPda, {
      authority: pubkey,
      did: `did:sol:${pubkey.toBase58()}`,
      docUri: 'http://example.com',
      docHash: new Uint8Array(32),
      hasVoted: false,
      bump: 255,
    })

    setupWallet(pubkey)
    render(<DidProvider><TestConsumer /></DidProvider>)

    await waitFor(() => {
      expect(screen.getByTestId('linked')).toHaveTextContent('true')
    })
  })
})
