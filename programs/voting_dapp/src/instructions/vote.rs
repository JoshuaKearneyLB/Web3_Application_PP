use anchor_lang::prelude::*;

use crate::{constants::{CANDIDATE_SEED, POLL_SEED, VOTE_RECORD_SEED}, error::ErrorCode, state::{Candidate, Poll, VoteRecord, Voter}};

#[derive(Accounts)]
pub struct Vote<'info> {
    // The poll — must be active for voting to proceed
    #[account(
        seeds = [POLL_SEED.as_bytes(), poll.name.as_bytes()],
        bump = poll.bump
    )]
    pub poll: Account<'info, Poll>,

    // The candidate the voter is voting for — vote_count will be incremented
    #[account(
        mut,
        seeds = [CANDIDATE_SEED.as_bytes(), poll.key().as_ref(), candidate.name.as_bytes()],
        bump = candidate.bump
    )]
    pub candidate: Account<'info, Candidate>,

    // The voter's registration account — proves they registered via DID
    #[account(
        seeds = [crate::constants::SEED.as_bytes(), authority.key().as_ref()],
        bump = voter.bump,
        has_one = authority
    )]
    pub voter: Account<'info, Voter>,

    // Per-poll vote record — init fails if voter already voted in this poll
    #[account(
        init,
        payer = authority,
        space = 8 + VoteRecord::INIT_SPACE,
        seeds = [VOTE_RECORD_SEED.as_bytes(), poll.key().as_ref(), authority.key().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<Vote>) -> Result<()> {
    require!(ctx.accounts.poll.is_active, ErrorCode::VotingClosed);

    // Record the vote
    let vote_record = &mut ctx.accounts.vote_record;
    vote_record.poll = ctx.accounts.poll.key();
    vote_record.voter = ctx.accounts.authority.key();
    vote_record.bump = ctx.bumps.vote_record;

    // Increment the candidate's tally
    ctx.accounts.candidate.vote_count += 1;

    Ok(())
}
