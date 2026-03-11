/**
 * On-chain Voter Account Viewer
 *
 * Usage: node verify-hash.cjs <WALLET_PUBKEY>
 *
 * Shows the on-chain voter account data including DID, doc_uri, and doc_hash.
 *
 * To verify the hash matches localStorage (paste in browser console):
 *
 *   const stored = localStorage.getItem('did_doc_YOUR_WALLET_PUBKEY_HERE');
 *   crypto.subtle.digest('SHA-256', new TextEncoder().encode(stored))
 *     .then(hashBuffer => {
 *       const hex = Array.from(new Uint8Array(hashBuffer))
 *         .map(b => b.toString(16).padStart(2, '0'))
 *         .join('');
 *       console.log('localStorage hash:', hex);
 *       console.log('On-chain hash:    ', 'PASTE_DOC_HASH_FROM_SCRIPT_OUTPUT');
 *       console.log('Match:', hex === 'PASTE_DOC_HASH_FROM_SCRIPT_OUTPUT');
 *     });
 *
 */

const { PublicKey, Connection } = require('@solana/web3.js');
const { AnchorProvider, Program } = require('@coral-xyz/anchor');
const idl = require('../target/idl/voting_dapp.json');

const walletPubkey = new PublicKey(process.argv[2]);
const programId = new PublicKey('HRcWpZaiBKPPE9jHMYEFhAEkr1g1G4PDrGDNFFR7oL4U');
const connection = new Connection('http://127.0.0.1:8899');

// Derive voter PDA
const [voterPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('anchor'), walletPubkey.toBuffer()],
  programId
);

console.log('Voter PDA:', voterPda.toString());

// Fetch account (read-only)
const provider = new AnchorProvider(connection, {}, {});
const program = new Program(idl, provider);

program.account.voter.fetch(voterPda)
  .then(account => {
    console.log('\nOn-chain Voter account:');
    console.log('  DID:', account.did);
    console.log('  doc_uri:', account.docUri);
    console.log('  doc_hash:', Buffer.from(account.docHash).toString('hex'));
    console.log('  has_voted:', account.hasVoted);
    console.log('  authority:', account.authority.toString());
    console.log('\nTo verify: hash the DID doc in localStorage and compare to doc_hash above');
  })
  .catch(err => {
    console.error('Error fetching account:', err.message);
  });