use anchor_lang::prelude::*;

use crate::{constants::{CANDIDATE_SEED, CANDIDATE_NAME_MAX_LENGTH}, error::ErrorCode, state::Candidate};

#[derive(Accounts)]
#[instruction(name: String)]
pub struct CreateCandidate<'info> {
    // PDA for this candidate, seeded by "candidate" + name so duplicate names are impossible
    #[account(
        init,
        payer = authority,
        space = 8 + Candidate::INIT_SPACE,
        seeds = [CANDIDATE_SEED.as_bytes(), name.as_bytes()],
        bump
    )]
    pub candidate: Account<'info, Candidate>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<CreateCandidate>, name: String) -> Result<()> {
    require!(!name.is_empty(), ErrorCode::CandidateNameEmpty);
    require!(
        name.as_bytes().len() <= CANDIDATE_NAME_MAX_LENGTH,
        ErrorCode::CandidateNameTooLong
    );

    let candidate = &mut ctx.accounts.candidate;
    candidate.name = name;
    candidate.vote_count = 0;
    candidate.bump = ctx.bumps.candidate;

    Ok(())
}
