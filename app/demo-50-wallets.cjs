/**
 * 50-Wallet Voting Demo
 *
 * Before running:
 * 1. Start localnet:  anchor localnet  (in a separate terminal)
 * 2. Start frontend:  npm run dev  (in another terminal)
 * 3. In the browser: create a poll, add candidates, open voting
 * 4. Export your Phantom private key:
 *    Phantom → Settings → Security & Privacy → Export Private Key → copy the base58 string
 * 5. Run:  ADMIN_KEY=<your_key> node demo-50-wallets.cjs
 *
 * The script finds your active poll automatically, generates 50 voters,
 * issues credentials, registers DIDs, and casts random votes.
 * The admin key is only held in memory — never written to disk.
 */

const { Keypair, Connection, PublicKey, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js')
const { AnchorProvider, Program, Wallet } = require('@coral-xyz/anchor')
const bs58 = require('bs58')
const crypto = require('crypto')
const idl = require('../target/idl/voting_dapp.json')

const RPC = 'http://127.0.0.1:8899'
const NUM_VOTERS = 50

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest()
}

function log(step, total, msg) {
  console.log(`[${step}/${total}] ${msg}`)
}

function progress(current, total) {
  const width = 40
  const filled = Math.round((current / total) * width)
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled)
  process.stdout.write(`\r  ${bar} ${current}/${total}`)
  if (current === total) console.log()
}

async function airdropAndConfirm(connection, pubkey, lamports) {
  const sig = await connection.requestAirdrop(pubkey, lamports)
  await connection.confirmTransaction(sig, 'confirmed')
}

async function main() {
  const TOTAL_STEPS = 7
  console.log('\n=== 50-Wallet Voting Demo ===\n')

  // Step 1: Load admin keypair
  if (!process.env.ADMIN_KEY) {
    console.error('ERROR: Set ADMIN_KEY env var to your Phantom private key (base58)')
    console.error('Usage: ADMIN_KEY=<key> node demo-50-wallets.cjs')
    process.exit(1)
  }
  const adminKeypair = Keypair.fromSecretKey(bs58.decode(process.env.ADMIN_KEY))
  log(1, TOTAL_STEPS, 'Loading admin keypair...')
  console.log(`  Admin: ${adminKeypair.publicKey.toBase58()}`)

  const connection = new Connection(RPC, 'confirmed')
  const adminWallet = new Wallet(adminKeypair)
  const adminProvider = new AnchorProvider(connection, adminWallet, { commitment: 'confirmed' })
  const adminProgram = new Program(idl, adminProvider)

  // Find the active poll
  const allPolls = await adminProgram.account.poll.all()
  const activePoll = allPolls.find(p => p.account.isActive)
  if (!activePoll) {
    console.error('ERROR: No active poll found. Create a poll, add candidates, and open voting in the browser first.')
    process.exit(1)
  }
  const pollPda = activePoll.publicKey
  console.log(`  Active poll: "${activePoll.account.name}"`)

  // Find candidates for this poll
  const allCandidates = await adminProgram.account.candidate.all()
  const pollCandidates = allCandidates.filter(c => c.account.poll.equals(pollPda))
  if (pollCandidates.length === 0) {
    console.error('ERROR: No candidates found for this poll. Add candidates in the browser first.')
    process.exit(1)
  }
  console.log(`  Candidates: ${pollCandidates.map(c => c.account.name).join(', ')}`)

  // Step 2: Airdrop to admin
  log(2, TOTAL_STEPS, 'Airdropping SOL to admin...')
  await airdropAndConfirm(connection, adminKeypair.publicKey, 10 * LAMPORTS_PER_SOL)
  console.log('  Admin balance: 10 SOL')

  // Step 3: Generate 50 wallets + airdrop
  log(3, TOTAL_STEPS, `Generating ${NUM_VOTERS} wallets and airdropping SOL...`)
  const voters = Array.from({ length: NUM_VOTERS }, () => Keypair.generate())
  for (let i = 0; i < voters.length; i++) {
    await airdropAndConfirm(connection, voters[i].publicKey, 0.5 * LAMPORTS_PER_SOL)
    progress(i + 1, NUM_VOTERS)
  }

  // Step 4: Issue credentials to all voters
  log(4, TOTAL_STEPS, `Issuing credentials to ${NUM_VOTERS} wallets...`)
  const salt = crypto.randomBytes(32).toString('hex')
  for (let i = 0; i < voters.length; i++) {
    const voter = voters[i]
    const studentId = `STU-${String(i + 1).padStart(3, '0')}`

    const vcJson = JSON.stringify({
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'VoterEligibilityCredential'],
      issuer: `did:sol:${adminKeypair.publicKey.toBase58()}`,
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: `did:sol:${voter.publicKey.toBase58()}`,
        eligibility: { type: 'VoterEligibility', eligible: true, reason: 'Verified by election administrator' },
      },
    })

    const credentialHash = sha256(vcJson)
    const identityHash = sha256(studentId + salt)

    const [credentialPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('credential'), voter.publicKey.toBuffer()],
      adminProgram.programId,
    )
    const [identityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('identity'), identityHash],
      adminProgram.programId,
    )

    await adminProgram.methods
      .issueCredential(credentialHash, identityHash)
      .accounts({
        credential: credentialPda,
        identity: identityPda,
        subject: voter.publicKey,
        admin: adminKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    progress(i + 1, NUM_VOTERS)
  }

  // Step 5: Each voter registers DID
  log(5, TOTAL_STEPS, `Registering DIDs (with embedded VCs)...`)
  for (let i = 0; i < voters.length; i++) {
    const voter = voters[i]
    const voterWallet = new Wallet(voter)
    const voterProvider = new AnchorProvider(connection, voterWallet, { commitment: 'confirmed' })
    const voterProgram = new Program(idl, voterProvider)

    const did = `did:sol:${voter.publicKey.toBase58()}`
    const keyId = `${did}#key-1`

    const [credentialPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('credential'), voter.publicKey.toBuffer()],
      voterProgram.programId,
    )
    const credentialData = await voterProgram.account.credential.fetch(credentialPda)

    const doc = {
      id: did,
      verificationMethod: [{
        id: keyId,
        type: 'Ed25519VerificationKey2018',
        controller: did,
        publicKeyBase58: voter.publicKey.toBase58(),
      }],
      authentication: [keyId],
      assertionMethod: [keyId],
      service: [{
        id: `${did}#resolver`,
        type: 'DIDResolutionService',
        serviceEndpoint: 'http://localhost:5173/did.json',
      }],
      created: new Date().toISOString(),
      verifiableCredential: [{
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'VoterEligibilityCredential'],
        issuer: `did:sol:${credentialData.issuer.toBase58()}`,
        issuanceDate: new Date(credentialData.issuedAt.toNumber() * 1000).toISOString(),
        credentialSubject: {
          id: did,
          eligibility: { type: 'VoterEligibility', eligible: true, reason: 'Verified by election administrator' },
        },
      }],
    }

    const docJson = JSON.stringify(doc)
    const docHash = sha256(docJson)

    const [voterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('anchor'), voter.publicKey.toBuffer()],
      voterProgram.programId,
    )

    await voterProgram.methods
      .initialize(did, doc.service[0].serviceEndpoint, docHash)
      .accounts({
        voter: voterPda,
        credential: credentialPda,
        authority: voter.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    progress(i + 1, NUM_VOTERS)
  }

  // Step 6: Each voter votes for a random candidate
  log(6, TOTAL_STEPS, `Casting ${NUM_VOTERS} votes (random candidates)...`)
  for (let i = 0; i < voters.length; i++) {
    const voter = voters[i]
    const voterWallet = new Wallet(voter)
    const voterProvider = new AnchorProvider(connection, voterWallet, { commitment: 'confirmed' })
    const voterProgram = new Program(idl, voterProvider)

    const pick = pollCandidates[Math.floor(Math.random() * pollCandidates.length)]

    const [voterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('anchor'), voter.publicKey.toBuffer()],
      voterProgram.programId,
    )
    const [voteRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vote_record'), pollPda.toBuffer(), voter.publicKey.toBuffer()],
      voterProgram.programId,
    )

    await voterProgram.methods
      .vote()
      .accounts({
        poll: pollPda,
        candidate: pick.publicKey,
        voter: voterPda,
        voteRecord: voteRecordPda,
        authority: voter.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    progress(i + 1, NUM_VOTERS)
  }

  // Step 7: Done
  log(7, TOTAL_STEPS, `Done — ${NUM_VOTERS} wallets voted. Check the frontend Results page.`)
  console.log()
}

const start = Date.now()
main()
  .then(() => {
    console.log(`  Time: ${Math.round((Date.now() - start) / 1000)}s\n`)
  })
  .catch((err) => {
    console.error('\nScript failed:', err.message || err)
    process.exit(1)
  })
