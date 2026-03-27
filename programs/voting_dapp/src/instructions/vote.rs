use anchor_lang::prelude::*;

use crate::{constants::{CANDIDATE_SEED, POLL_SEED}, error::ErrorCode, state::{Candidate, Poll, Voter}};

#[derive(Accounts)]
pub struct Vote<'info> {
    // The poll — must be active for voting to proceed
    #[account(
        seeds = [POLL_SEED.as_bytes()],
        bump = poll.bump
    )]
    pub poll: Account<'info, Poll>,

    // The candidate the voter is voting for — vote_count will be incremented
    #[account(
        mut,
        seeds = [CANDIDATE_SEED.as_bytes(), candidate.name.as_bytes()],
        bump = candidate.bump
    )]
    pub candidate: Account<'info, Candidate>,

    // The voter's registration account — has_voted will be flipped to true
    #[account(
        mut,
        seeds = [crate::constants::SEED.as_bytes(), authority.key().as_ref()],
        bump = voter.bump,
        has_one = authority
    )]
    pub voter: Account<'info, Voter>,

    pub authority: Signer<'info>,
}

pub(crate) fn handler(ctx: Context<Vote>) -> Result<()> {
    require!(ctx.accounts.poll.is_active, ErrorCode::VotingClosed);

    let voter = &mut ctx.accounts.voter;
    require!(!voter.has_voted, ErrorCode::AlreadyVoted);

    voter.has_voted = true;
    ctx.accounts.candidate.vote_count += 1;

    Ok(())
}
