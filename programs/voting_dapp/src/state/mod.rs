use anchor_lang::prelude::*;

use crate::constants::DID_MAX_LENGTH;

//Create a voter account structure 
#[account]
pub struct Voter {
    pub authority: Pubkey, // Which wallet owns the voter account
    pub did: String, // did string e.g did:sol:walletaddr
    pub has_voted: bool,
    pub bump: u8, // Added to ensure PDA does not conflict with a wallet
}

impl Voter {
    pub const MAX_DID_LEN: usize = DID_MAX_LENGTH;
    pub const INIT_SPACE: usize = 32  // authority
        + 4
        + Self::MAX_DID_LEN // did string
        + 1 // has_voted
        + 1; // bump
}
