use anchor_lang::prelude::*;

use crate::{constants::{ADMIN_PUBKEY, CREDENTIAL_SEED}, error::ErrorCode, state::{Credential, Identity}};

#[derive(Accounts)]
#[instruction(credential_hash: Vec<u8>, identity_hash: Vec<u8>)]
pub struct IssueCredential<'info> {
    // Credential PDA — one per voter wallet
    #[account(
        init,
        payer = admin,
        space = 8 + Credential::INIT_SPACE,
        seeds = [CREDENTIAL_SEED.as_bytes(), subject.key().as_ref()],
        bump
    )]
    pub credential: Account<'info, Credential>,

    // Identity dedup PDA — init fails if this real-world identity was already used
    #[account(
        init,
        payer = admin,
        space = 8 + Identity::INIT_SPACE,
        seeds = [b"identity", identity_hash.as_slice()],
        bump
    )]
    pub identity: Account<'info, Identity>,

    /// CHECK: The voter wallet receiving the credential — does not need to sign
    pub subject: UncheckedAccount<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub(crate) fn handler(
    ctx: Context<IssueCredential>,
    credential_hash: Vec<u8>,
    identity_hash: Vec<u8>,
) -> Result<()> {
    // Only the hardcoded admin can issue credentials
    let admin_pubkey = ADMIN_PUBKEY.parse::<Pubkey>().unwrap();
    require!(
        ctx.accounts.admin.key() == admin_pubkey,
        ErrorCode::Unauthorized
    );

    require!(credential_hash.len() == 32, ErrorCode::CredentialHashInvalid);
    require!(identity_hash.len() == 32, ErrorCode::IdentityHashInvalid);

    let credential = &mut ctx.accounts.credential;
    credential.issuer = ctx.accounts.admin.key();
    credential.subject = ctx.accounts.subject.key();

    let mut ch = [0u8; 32];
    ch.copy_from_slice(&credential_hash);
    credential.credential_hash = ch;

    let mut ih = [0u8; 32];
    ih.copy_from_slice(&identity_hash);
    credential.identity_hash = ih;

    credential.is_revoked = false;
    credential.issued_at = Clock::get()?.unix_timestamp;
    credential.bump = ctx.bumps.credential;

    // Store bump on the identity account
    ctx.accounts.identity.bump = ctx.bumps.identity;

    Ok(())
}
