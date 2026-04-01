use anchor_lang::prelude::*;

use crate::{constants::{ADMIN_PUBKEY, POLL_SEED, POLL_NAME_MAX_LENGTH}, error::ErrorCode, state::Poll};

#[derive(Accounts)]
#[instruction(name: String)]
pub struct CreatePoll<'info> {
    // Poll PDA — seeded by "poll" + name so multiple polls can coexist
    #[account(
        init,
        payer = authority,
        space = 8 + Poll::INIT_SPACE,
        seeds = [POLL_SEED.as_bytes(), name.as_bytes()],
        bump
    )]
    pub poll: Account<'info, Poll>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(ctx: Context<CreatePoll>, name: String) -> Result<()> {
    // Only the hardcoded admin wallet can create a poll
    let admin = ADMIN_PUBKEY.parse::<Pubkey>().unwrap();
    require!(
        ctx.accounts.authority.key() == admin,
        ErrorCode::Unauthorized
    );

    require!(!name.is_empty(), ErrorCode::PollNameEmpty);
    require!(
        name.as_bytes().len() <= POLL_NAME_MAX_LENGTH,
        ErrorCode::PollNameTooLong
    );

    let poll = &mut ctx.accounts.poll;
    poll.admin = ctx.accounts.authority.key();
    poll.name = name;
    poll.is_active = false;
    poll.bump = ctx.bumps.poll;

    Ok(())
}
