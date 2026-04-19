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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_variants_exist() {
        // Exhaustive match — if any variant is removed, this fails to compile
        let variants = [
            ErrorCode::CustomError,
            ErrorCode::DidTooLong,
            ErrorCode::DidDocUriTooLong,
            ErrorCode::DidDocHashLengthInvalid,
            ErrorCode::CandidateNameTooLong,
            ErrorCode::CandidateNameEmpty,
            ErrorCode::AlreadyVoted,
            ErrorCode::Unauthorized,
            ErrorCode::VotingClosed,
            ErrorCode::PollNameEmpty,
            ErrorCode::PollNameTooLong,
            ErrorCode::CredentialRevoked,
            ErrorCode::CredentialSubjectMismatch,
            ErrorCode::CredentialHashInvalid,
            ErrorCode::IdentityHashInvalid,
            ErrorCode::PollStillActive,
        ];
        assert_eq!(variants.len(), 16);
    }

    #[test]
    fn test_variant_ordering() {
        // Casting to u32 gives the variant index (0, 1, 2...) in declaration order.
        // Anchor transforms these into 6000+ error codes internally at runtime.
        assert_eq!(ErrorCode::CustomError as u32, 0);
        assert_eq!(ErrorCode::DidTooLong as u32, 1);
        assert_eq!(ErrorCode::DidDocUriTooLong as u32, 2);
        assert_eq!(ErrorCode::PollStillActive as u32, 15);
    }
}
