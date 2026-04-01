use anchor_lang::prelude::*;

use crate::{constants::CREDENTIAL_SEED, state::Credential};

#[derive(Accounts)]
pub struct RevokeCredential<'info> {
    #[account(
        mut,
        seeds = [CREDENTIAL_SEED.as_bytes(), credential.subject.as_ref()],
        bump = credential.bump,
        has_one = issuer,
    )]
    pub credential: Account<'info, Credential>,

    // Only the original issuer (admin) can revoke
    pub issuer: Signer<'info>,
}

pub(crate) fn handler(ctx: Context<RevokeCredential>) -> Result<()> {
    ctx.accounts.credential.is_revoked = true;
    Ok(())
}
