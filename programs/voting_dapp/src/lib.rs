pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

// This is where the main smart contract is.

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

//Program ID declared here
declare_id!("HRcWpZaiBKPPE9jHMYEFhAEkr1g1G4PDrGDNFFR7oL4U");


//Exposing initialize and forward arguments to handler in initialize.rs
#[program]
pub mod voting_dapp {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        did: String,
        doc_uri: String,
        doc_hash: Vec<u8>,
    ) -> Result<()> {
        initialize::handler(ctx, did, doc_uri, doc_hash)
    }

    pub fn create_poll(ctx: Context<CreatePoll>, name: String) -> Result<()> {
        create_poll::handler(ctx, name)
    }

    pub fn create_candidate(ctx: Context<CreateCandidate>, name: String) -> Result<()> {
        create_candidate::handler(ctx, name)
    }

    pub fn toggle_voting(ctx: Context<ToggleVoting>) -> Result<()> {
        toggle_voting::handler(ctx)
    }

    pub fn vote(ctx: Context<Vote>) -> Result<()> {
        vote::handler(ctx)
    }

    pub fn close_candidate(ctx: Context<CloseCandidate>) -> Result<()> {
        close_candidate::handler(ctx)
    }

    pub fn close_poll(ctx: Context<ClosePoll>) -> Result<()> {
        close_poll::handler(ctx)
    }

    pub fn issue_credential(
        ctx: Context<IssueCredential>,
        credential_hash: Vec<u8>,
        identity_hash: Vec<u8>,
    ) -> Result<()> {
        issue_credential::handler(ctx, credential_hash, identity_hash)
    }

    pub fn revoke_credential(ctx: Context<RevokeCredential>) -> Result<()> {
        revoke_credential::handler(ctx)
    }
}
