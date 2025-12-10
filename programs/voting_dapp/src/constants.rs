use anchor_lang::prelude::*;

// Used for basic validation of a DID string
#[constant]
pub const SEED: &str = "anchor";

// Maximum length for a DID string stored on-chain (did:sol:<base58 pubkey> fits)
#[constant]
pub const DID_MAX_LENGTH: usize = 64;

// Maximum length for an off-chain DID document URI.
#[constant]
pub const DID_DOC_URI_MAX_LENGTH: usize = 200;
