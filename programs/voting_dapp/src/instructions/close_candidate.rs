use anchor_lang::prelude::*;

use crate::{constants::{CANDIDATE_SEED, POLL_SEED}, state::{Candidate, Poll}};

#[derive(Accounts)]
pub struct CloseCandidate<'info> {
    #[account(
        seeds = [POLL_SEED.as_bytes(), poll.name.as_bytes()],
        bump = poll.bump,
        has_one = admin,
    )]
    pub poll: Account<'info, Poll>,

    #[account(
        mut,
        close = admin,
        seeds = [CANDIDATE_SEED.as_bytes(), poll.key().as_ref(), candidate.name.as_bytes()],
        bump = candidate.bump,
    )]
    pub candidate: Account<'info, Candidate>,

    #[account(mut)]
    pub admin: Signer<'info>,
}

pub(crate) fn handler(_ctx: Context<CloseCandidate>) -> Result<()> {
    // The close = admin constraint handles everything
    Ok(())
}
