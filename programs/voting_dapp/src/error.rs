use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Custom error message")]
    CustomError,
    #[msg("DID string is too long")]
    DidTooLong,
    #[msg("DID document URI is too long")]
    DidDocUriTooLong,
    #[msg("DID document hash must be 32 bytes (e.g. SHA-256)")]
    DidDocHashLengthInvalid,
}
