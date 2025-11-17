pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

// This is where the main smart contract is.

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("HRcWpZaiBKPPE9jHMYEFhAEkr1g1G4PDrGDNFFR7oL4U");

#[program]
pub mod voting_dapp {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        initialize::handler(ctx)
    }
}
