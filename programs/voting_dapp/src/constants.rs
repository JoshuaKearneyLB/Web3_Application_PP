use anchor_lang::prelude::*;

// Used for basic validation of a DID string
#[constant]
pub const SEED: &str = "anchor";

// Maximum length for a DID string stored on-chain (did:sol:<base58 pubkey> fits)
pub const DID_MAX_LENGTH: usize = 64;

// Maximum length for an off-chain DID document URI.
pub const DID_DOC_URI_MAX_LENGTH: usize = 200;

// Seed and max length for candidate accounts
pub const CANDIDATE_SEED: &str = "candidate";
pub const CANDIDATE_NAME_MAX_LENGTH: usize = 64;

// Seed for the single poll account
pub const POLL_SEED: &str = "poll";
pub const POLL_NAME_MAX_LENGTH: usize = 64;

// Hardcoded admin wallet — only this Phantom wallet can create polls and candidates
pub const ADMIN_PUBKEY: &str = "4Dx9jxLKkqM3J7t4R3Q4G3YnzKKvKhJJn5CWVgCFrQD3";
