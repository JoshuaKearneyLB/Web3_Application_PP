use anchor_lang::prelude::*;

use crate::constants::{CANDIDATE_NAME_MAX_LENGTH, DID_DOC_URI_MAX_LENGTH, DID_MAX_LENGTH, POLL_NAME_MAX_LENGTH};

// Create a voter account structure
#[account]
pub struct Voter {
    pub authority: Pubkey,            // Which wallet owns the voter account
    pub did: String,                  // DID string e.g did:sol:walletaddr
    pub doc_uri: String,              // Off-chain URI where the DID document lives
    pub doc_hash: [u8; Self::DOC_HASH_LEN], // Hash of the DID document for integrity
    pub has_voted: bool,              // Vestigial — replaced by per-poll VoteRecord PDA. Kept to preserve account layout.
    pub bump: u8, // Added to ensure PDA does not conflict with a wallet
}

impl Voter {
    pub const MAX_DID_LEN: usize = DID_MAX_LENGTH;
    pub const MAX_DOC_URI_LEN: usize = DID_DOC_URI_MAX_LENGTH;
    pub const DOC_HASH_LEN: usize = 32; // e.g. SHA-256 hash length
    pub const INIT_SPACE: usize = 32  // authority
        + 4
        + Self::MAX_DID_LEN // did string
        + 4
        + Self::MAX_DOC_URI_LEN // doc_uri string
        + Self::DOC_HASH_LEN // doc_hash bytes
        + 1 // has_voted
        + 1; // bump
}

// Stores a poll candidate name and its running vote tally
#[account]
pub struct Candidate {
    pub poll: Pubkey,       // Which poll this candidate belongs to
    pub name: String,       // Candidate name e.g. "Alice"
    pub vote_count: u64,    // Incremented each time a voter picks this candidate
    pub bump: u8,
}

impl Candidate {
    pub const MAX_NAME_LEN: usize = CANDIDATE_NAME_MAX_LENGTH;
    pub const INIT_SPACE: usize = 32  // poll pubkey
        + 4 + Self::MAX_NAME_LEN  // name string (4-byte length prefix + data)
        + 8   // vote_count (u64)
        + 1;  // bump
}

// Per-poll vote record — if this PDA exists, the voter has voted in this poll
#[account]
pub struct VoteRecord {
    pub poll: Pubkey,       // Which poll this vote was cast in
    pub voter: Pubkey,      // Which voter cast this vote
    pub bump: u8,
}

impl VoteRecord {
    pub const INIT_SPACE: usize = 32  // poll
        + 32  // voter
        + 1;  // bump
}

// The single poll account that controls the voting event
#[account]
pub struct Poll {
    pub admin: Pubkey,      // Wallet that can create candidates and manage the poll
    pub name: String,       // Poll title e.g. "Student Council Election"
    pub is_active: bool,    // Whether voting is currently open
    pub bump: u8,
}

impl Poll {
    pub const MAX_NAME_LEN: usize = POLL_NAME_MAX_LENGTH;
    pub const INIT_SPACE: usize = 32  // admin pubkey
        + 4 + Self::MAX_NAME_LEN  // name string
        + 1   // is_active
        + 1;  // bump
}

// Verifiable Credential — issued by admin to authorize a wallet to vote
#[account]
pub struct Credential {
    pub issuer: Pubkey,              // Admin who issued it
    pub subject: Pubkey,             // Wallet this credential is for
    pub credential_hash: [u8; 32],   // SHA-256 of the off-chain VC JSON
    pub identity_hash: [u8; 32],     // Blinded hash of real-world ID (Sybil protection)
    pub is_revoked: bool,            // Admin can revoke
    pub issued_at: i64,              // Unix timestamp from Clock sysvar
    pub bump: u8,
}

impl Credential {
    pub const DOC_HASH_LEN: usize = 32;
    pub const INIT_SPACE: usize = 32  // issuer
        + 32  // subject
        + 32  // credential_hash
        + 32  // identity_hash
        + 1   // is_revoked
        + 8   // issued_at
        + 1;  // bump
}

// Minimal account for identity deduplication — if PDA exists, that real-world identity is taken
#[account]
pub struct Identity {
    pub bump: u8,
}

impl Identity {
    pub const INIT_SPACE: usize = 1; // bump only
}
