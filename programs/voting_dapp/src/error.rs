use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Custom error message")]
    CustomError,
    #[msg("DID string is too long")]
    DidTooLong,
}
