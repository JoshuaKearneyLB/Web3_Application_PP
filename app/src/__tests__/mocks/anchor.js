import { vi } from 'vitest'
import { PublicKey } from '@solana/web3.js'

// Shared state that tests can configure
const state = {
  accounts: {
    voter: new Map(),
    credential: new Map(),
    poll: new Map(),
    candidate: new Map(),
    voteRecord: new Map(),
    identity: new Map(),
  },
  rpcCalls: [],
  rpcResult: 'mock-signature',
  rpcError: null,
}

export function resetMockState() {
  for (const key of Object.keys(state.accounts)) state.accounts[key].clear()
  state.rpcCalls.length = 0
  state.rpcResult = 'mock-signature'
  state.rpcError = null
}

export function setAccount(type, pubkey, value) {
  state.accounts[type].set(pubkey.toBase58(), value)
}

export function setAllAccounts(type, entries) {
  state.accounts[type].clear()
  for (const { publicKey, account } of entries) {
    state.accounts[type].set(publicKey.toBase58(), { publicKey, account })
  }
}

export function getRpcCalls() {
  return state.rpcCalls
}

export function setRpcError(err) {
  state.rpcError = err
}

function makeAccountNamespace(type) {
  return {
    fetch: vi.fn(async (pubkey) => {
      const entry = state.accounts[type].get(pubkey.toBase58())
      if (!entry) throw new Error(`Account not found for ${type}`)
      return entry.account || entry
    }),
    all: vi.fn(async () => {
      return Array.from(state.accounts[type].values()).map(v =>
        v.publicKey ? v : { publicKey: null, account: v }
      ).filter(v => v.publicKey)
    }),
  }
}

function makeMethodsChain(methodName) {
  const chain = {
    accounts: vi.fn(() => chain),
    signers: vi.fn(() => chain),
    rpc: vi.fn(async () => {
      if (state.rpcError) throw state.rpcError
      state.rpcCalls.push({ method: methodName })
      return state.rpcResult
    }),
  }
  return chain
}

const PROGRAM_ID = new PublicKey('HRcWpZaiBKPPE9jHMYEFhAEkr1g1G4PDrGDNFFR7oL4U')

export function makeMockProgram() {
  return {
    programId: PROGRAM_ID,
    account: {
      voter: makeAccountNamespace('voter'),
      credential: makeAccountNamespace('credential'),
      poll: makeAccountNamespace('poll'),
      candidate: makeAccountNamespace('candidate'),
      voteRecord: makeAccountNamespace('voteRecord'),
      identity: makeAccountNamespace('identity'),
    },
    methods: {
      initialize: vi.fn((...args) => {
        state.rpcCalls.push({ method: 'initialize', args })
        return makeMethodsChain('initialize')
      }),
      createPoll: vi.fn((...args) => {
        state.rpcCalls.push({ method: 'createPoll', args })
        return makeMethodsChain('createPoll')
      }),
      toggleVoting: vi.fn(() => makeMethodsChain('toggleVoting')),
      createCandidate: vi.fn((...args) => {
        state.rpcCalls.push({ method: 'createCandidate', args })
        return makeMethodsChain('createCandidate')
      }),
      closeCandidate: vi.fn(() => makeMethodsChain('closeCandidate')),
      closePoll: vi.fn(() => makeMethodsChain('closePoll')),
      vote: vi.fn(() => makeMethodsChain('vote')),
      issueCredential: vi.fn((...args) => {
        state.rpcCalls.push({ method: 'issueCredential', args })
        return makeMethodsChain('issueCredential')
      }),
      revokeCredential: vi.fn(() => makeMethodsChain('revokeCredential')),
    },
  }
}

// Mocks are installed per-test-file via vi.mock at the top of each file —
// we can't install globally here because vi.mock calls get hoisted to the
// calling file's scope only when written inline.
