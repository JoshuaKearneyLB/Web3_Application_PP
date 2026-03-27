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
}
