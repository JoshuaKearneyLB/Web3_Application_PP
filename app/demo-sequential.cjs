/**
 * Sequential Voting Demo — one voter at a time
 *
 * Unlike demo-50-wallets.cjs (batch mode), this script processes each voter
 * through their FULL lifecycle before moving to the next:
 *   airdrop → credential → DID registration → vote → next voter
 *
 * This mirrors how real users interact with the system and shows votes
 * ticking up one by one on the Results page.
 *
 * Before running:
 * 1. Start localnet:  anchor localnet  (in a separate terminal)
 * 2. Start frontend:  npm run dev  (in another terminal)
 * 3. In the browser: create a poll, add candidates, open voting
 * 4. Run:  node demo-sequential.cjs
 */

const { Keypair, Connection, PublicKey, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js')
const { AnchorProvider, Program, Wallet } = require('@coral-xyz/anchor')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const idl = require('../target/idl/voting_dapp.json')

const ADMIN_KEYPAIR_PATH = path.join(os.homedir(), '.config/solana/phantom-wallet.json')

const RPC = 'http://127.0.0.1:8899'
const NUM_VOTERS = 50

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest()
}

async function airdropAndConfirm(connection, pubkey, lamports) {
  const sig = await connection.requestAirdrop(pubkey, lamports)
  await connection.confirmTransaction(sig, 'confirmed')
}

async function main() {
  console.log('\n=== Sequential Voting Demo ===\n')

  // Load admin keypair
  if (!fs.existsSync(ADMIN_KEYPAIR_PATH)) {
    console.error(`ERROR: Admin keypair not found at ${ADMIN_KEYPAIR_PATH}`)
    process.exit(1)
  }
  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(ADMIN_KEYPAIR_PATH, 'utf-8')))
  const adminKeypair = Keypair.fromSecretKey(secretKey)
  console.log(`Admin: ${adminKeypair.publicKey.toBase58()}`)

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
  console.log(`Poll: "${activePoll.account.name}"`)

  // Find candidates
  const allCandidates = await adminProgram.account.candidate.all()
  const pollCandidates = allCandidates.filter(c => c.account.poll.equals(pollPda))
  if (pollCandidates.length === 0) {
    console.error('ERROR: No candidates found for this poll.')
    process.exit(1)
  }
  console.log(`Candidates: ${pollCandidates.map(c => c.account.name).join(', ')}`)

  // Airdrop to admin
  console.log('\nAirdropping SOL to admin...')
  await airdropAndConfirm(connection, adminKeypair.publicKey, 10 * LAMPORTS_PER_SOL)

  const salt = crypto.randomBytes(32).toString('hex')

  console.log(`\nProcessing ${NUM_VOTERS} voters sequentially:\n`)

  // Process each voter through the full lifecycle
  for (let i = 0; i < NUM_VOTERS; i++) {
    const voter = Keypair.generate()
    const studentId = `STU-${String(i + 1).padStart(3, '0')}`
    const did = `did:sol:${voter.publicKey.toBase58()}`
    const pick = pollCandidates[Math.floor(Math.random() * pollCandidates.length)]

    process.stdout.write(`  Voter ${String(i + 1).padStart(3)} / ${NUM_VOTERS}  ${voter.publicKey.toBase58().slice(0, 12)}…  `)

    // 1. Airdrop
    process.stdout.write('airdrop ')
    await airdropAndConfirm(connection, voter.publicKey, 0.5 * LAMPORTS_PER_SOL)

    // 2. Issue credential (admin signs)
    process.stdout.write('→ credential ')
    const vcJson = JSON.stringify({
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'VoterEligibilityCredential'],
      issuer: `did:sol:${adminKeypair.publicKey.toBase58()}`,
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: did,
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

    // 3. Register DID (voter signs)
    process.stdout.write('→ DID ')
    const voterWallet = new Wallet(voter)
    const voterProvider = new AnchorProvider(connection, voterWallet, { commitment: 'confirmed' })
    const voterProgram = new Program(idl, voterProvider)

    const credentialData = await voterProgram.account.credential.fetch(credentialPda)
    const keyId = `${did}#key-1`

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

    // 4. Vote (voter signs)
    process.stdout.write(`→ vote(${pick.account.name})`)

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

    console.log(' ✓')
  }

  console.log(`\nDone — ${NUM_VOTERS} voters processed sequentially. Check the frontend Results page.`)
}

const start = Date.now()
main()
  .then(() => {
    console.log(`Time: ${Math.round((Date.now() - start) / 1000)}s\n`)
  })
  .catch((err) => {
    console.error('\nScript failed:', err.message || err)
    process.exit(1)
  })
