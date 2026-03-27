use anchor_lang::prelude::*;

use crate::constants::{CANDIDATE_NAME_MAX_LENGTH, DID_DOC_URI_MAX_LENGTH, DID_MAX_LENGTH, POLL_NAME_MAX_LENGTH};

// Create a voter account structure
#[account]
pub struct Voter {
    pub authority: Pubkey,            // Which wallet owns the voter account
    pub did: String,                  // DID string e.g did:sol:walletaddr
    pub doc_uri: String,              // Off-chain URI where the DID document lives
    pub doc_hash: [u8; Self::DOC_HASH_LEN], // Hash of the DID document for integrity
    pub has_voted: bool,
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
    pub name: String,       // Candidate name e.g. "Alice"
    pub vote_count: u64,    // Incremented each time a voter picks this candidate
    pub bump: u8,
}

impl Candidate {
    pub const MAX_NAME_LEN: usize = CANDIDATE_NAME_MAX_LENGTH;
    pub const INIT_SPACE: usize = 4 + Self::MAX_NAME_LEN  // name string (4-byte length prefix + data)
        + 8   // vote_count (u64)
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
