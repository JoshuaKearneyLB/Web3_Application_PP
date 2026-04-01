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
    #[msg("Candidate name is too long")]
    CandidateNameTooLong,
    #[msg("Candidate name cannot be empty")]
    CandidateNameEmpty,
    #[msg("Voter has already voted")]
    AlreadyVoted,
    #[msg("Only the admin wallet can perform this action")]
    Unauthorized,
    #[msg("Voting is not currently active")]
    VotingClosed,
    #[msg("Poll name cannot be empty")]
    PollNameEmpty,
    #[msg("Poll name is too long")]
    PollNameTooLong,
    #[msg("Credential has been revoked")]
    CredentialRevoked,
    #[msg("Credential subject does not match the authority")]
    CredentialSubjectMismatch,
    #[msg("Credential hash must be 32 bytes")]
    CredentialHashInvalid,
    #[msg("Identity hash must be 32 bytes")]
    IdentityHashInvalid,
    #[msg("Poll must be closed before it can be deleted")]
    PollStillActive,
}
