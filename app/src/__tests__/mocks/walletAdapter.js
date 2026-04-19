import { vi } from 'vitest'
import { Keypair, PublicKey } from '@solana/web3.js'

const walletState = {
  publicKey: null,
  signTransaction: null,
  signAllTransactions: null,
}

export function resetWalletState() {
  walletState.publicKey = null
  walletState.signTransaction = null
  walletState.signAllTransactions = null
}

export function setConnectedWallet(publicKey) {
  walletState.publicKey = publicKey
  walletState.signTransaction = vi.fn()
  walletState.signAllTransactions = vi.fn()
}

export function setDisconnected() {
  resetWalletState()
}

export function generatePubkey() {
  return Keypair.generate().publicKey
}

export const ADMIN_PUBKEY_STR = '4Dx9jxLKkqM3J7t4R3Q4G3YnzKKvKhJJn5CWVgCFrQD3'
export const ADMIN_PUBKEY = new PublicKey(ADMIN_PUBKEY_STR)

export const mockUseWallet = vi.fn(() => walletState)
export const mockUseConnection = vi.fn(() => ({ connection: { getAccountInfo: vi.fn() } }))

export function installWalletMock() {
  vi.mock('@solana/wallet-adapter-react', () => ({
    useWallet: mockUseWallet,
    useConnection: mockUseConnection,
    ConnectionProvider: ({ children }) => children,
    WalletProvider: ({ children }) => children,
  }))

  vi.mock('@solana/wallet-adapter-react-ui', () => ({
    WalletMultiButton: () => null,
    WalletModalProvider: ({ children }) => children,
  }))
}
