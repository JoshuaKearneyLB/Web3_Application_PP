use anchor_lang::prelude::*;

use crate::{constants::POLL_SEED, error::ErrorCode, state::Poll};

#[derive(Accounts)]
pub struct ClosePoll<'info> {
    #[account(
        mut,
        close = admin,
        seeds = [POLL_SEED.as_bytes(), poll.name.as_bytes()],
        bump = poll.bump,
        has_one = admin,
    )]
    pub poll: Account<'info, Poll>,

    #[account(mut)]
    pub admin: Signer<'info>,
}

pub(crate) fn handler(ctx: Context<ClosePoll>) -> Result<()> {
    // Cannot delete a poll while voting is still open
    require!(!ctx.accounts.poll.is_active, ErrorCode::PollStillActive);
    Ok(())
}
