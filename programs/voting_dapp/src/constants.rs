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

// Seed for poll accounts (multiple polls supported, seeded by name)
pub const POLL_SEED: &str = "poll";
// Seed for per-poll vote records
pub const VOTE_RECORD_SEED: &str = "vote_record";
pub const POLL_NAME_MAX_LENGTH: usize = 64;

// Seed for credential accounts
pub const CREDENTIAL_SEED: &str = "credential";

// Hardcoded admin wallet — only this Phantom wallet can create polls and candidates
pub const ADMIN_PUBKEY: &str = "4Dx9jxLKkqM3J7t4R3Q4G3YnzKKvKhJJn5CWVgCFrQD3";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_admin_pubkey_parses() {
        let result = ADMIN_PUBKEY.parse::<Pubkey>();
        assert!(result.is_ok(), "ADMIN_PUBKEY must be valid base58");
    }

    #[test]
    fn test_admin_pubkey_length() {
        let pubkey = ADMIN_PUBKEY.parse::<Pubkey>().unwrap();
        assert_eq!(pubkey.to_bytes().len(), 32, "Pubkey must be 32 bytes");
    }

    #[test]
    fn test_admin_pubkey_round_trips() {
        // Parsing then re-serializing to base58 should produce the same string
        let pubkey = ADMIN_PUBKEY.parse::<Pubkey>().unwrap();
        assert_eq!(pubkey.to_string(), ADMIN_PUBKEY);
    }

    #[test]
    fn test_seed_values() {
        assert_eq!(SEED, "anchor");
        assert_eq!(POLL_SEED, "poll");
        assert_eq!(CANDIDATE_SEED, "candidate");
        assert_eq!(CREDENTIAL_SEED, "credential");
        assert_eq!(VOTE_RECORD_SEED, "vote_record");
    }

    #[test]
    fn test_seed_byte_lengths() {
        // Solana PDA seeds must be <= 32 bytes each
        const SOLANA_MAX_SEED_LEN: usize = 32;
        assert!(SEED.as_bytes().len() <= SOLANA_MAX_SEED_LEN);
        assert!(POLL_SEED.as_bytes().len() <= SOLANA_MAX_SEED_LEN);
        assert!(CANDIDATE_SEED.as_bytes().len() <= SOLANA_MAX_SEED_LEN);
        assert!(CREDENTIAL_SEED.as_bytes().len() <= SOLANA_MAX_SEED_LEN);
        assert!(VOTE_RECORD_SEED.as_bytes().len() <= SOLANA_MAX_SEED_LEN);
    }

    #[test]
    fn test_did_max_length() {
        assert_eq!(DID_MAX_LENGTH, 64);
    }

    #[test]
    fn test_did_doc_uri_max_length() {
        assert_eq!(DID_DOC_URI_MAX_LENGTH, 200);
    }

    #[test]
    fn test_candidate_name_max_length() {
        assert_eq!(CANDIDATE_NAME_MAX_LENGTH, 64);
    }

    #[test]
    fn test_poll_name_max_length() {
        assert_eq!(POLL_NAME_MAX_LENGTH, 64);
    }
}
