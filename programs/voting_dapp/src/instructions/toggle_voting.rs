use anchor_lang::prelude::*;

use crate::{constants::POLL_SEED, state::Poll};

#[derive(Accounts)]
pub struct ToggleVoting<'info> {
    #[account(
        mut,
        seeds = [POLL_SEED.as_bytes()],
        bump = poll.bump,
        has_one = admin,
    )]
    pub poll: Account<'info, Poll>,

    pub admin: Signer<'info>,
}

pub(crate) fn handler(ctx: Context<ToggleVoting>) -> Result<()> {
    let poll = &mut ctx.accounts.poll;
    poll.is_active = !poll.is_active;
    Ok(())
}
