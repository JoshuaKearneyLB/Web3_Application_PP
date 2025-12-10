use anchor_lang::prelude::*;

use crate::constants::{DID_DOC_URI_MAX_LENGTH, DID_MAX_LENGTH};

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
