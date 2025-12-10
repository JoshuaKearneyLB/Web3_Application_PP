use anchor_lang::prelude::*;

use crate::{constants::SEED, error::ErrorCode, state::Voter};

// THe bundle of account this instruction will need for this call
#[derive(Accounts)]
pub struct Initialize<'info> {
    // PDA that stores voter state, created by the authority
    #[account(
        init,
        payer = authority,
        space = 8 + Voter::INIT_SPACE,
        seeds = [SEED.as_bytes(), authority.key().as_ref()],
        bump
    )]
    pub voter: Account<'info, Voter>,
    #[account(mut)]
    pub authority: Signer<'info>,

    // System program needed to create the account
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<Initialize>,
    did: String,
    doc_uri: String,
    doc_hash: Vec<u8>,
) -> Result<()> {
    let voter = &mut ctx.accounts.voter;

    // reject DIDs that would overflow the allocated space
    require!(
        did.as_bytes().len() <= Voter::MAX_DID_LEN,
        ErrorCode::DidTooLong
    );

    // reject URIs that would overflow the allocated space
    require!(
        doc_uri.as_bytes().len() <= Voter::MAX_DOC_URI_LEN,
        ErrorCode::DidDocUriTooLong
    );

    // require a fixed-size hash (e.g., SHA-256)
    require!(
        doc_hash.len() == Voter::DOC_HASH_LEN,
        ErrorCode::DidDocHashLengthInvalid
    );

    // write caller identity and a default vote status to the account
    voter.authority = ctx.accounts.authority.key();
    voter.did = did;
    voter.doc_uri = doc_uri;
    let mut fixed_hash = [0u8; Voter::DOC_HASH_LEN];
    fixed_hash.copy_from_slice(&doc_hash);
    voter.doc_hash = fixed_hash;
    voter.has_voted = false;
    voter.bump = ctx.bumps.voter;

    Ok(()) // RETURNS OK
}
