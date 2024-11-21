use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, metadata::{MasterEditionAccount, Metadata, MetadataAccount}, token::{Mint, Token, TokenAccount}};

declare_id!("GzRHyTvHSCUtV3bG428B1xkig2X4grAddVRzK3BRpuhG");

#[program]
pub mod anchor_nft_staking {
    use anchor_lang::solana_program::program::invoke_signed;
    use anchor_spl::metadata::mpl_token_metadata::instructions::{FreezeDelegatedAccount, ThawDelegatedAccount};
    use anchor_spl::token::Revoke;
    use anchor_spl::token::{self, Approve, MintTo};

    use super::*;

    pub fn stake(ctx: Context<Stake>) -> Result<()> {
      msg!("Greetings from: {:?}", ctx.program_id);
      require!(
        ctx.accounts.stake_state.stake_state == StakeState::Unstaked,
        StakeError::AlreadyStaked
      );
      let clock = Clock::get().unwrap();

      msg!("Approving delegate");

      let cpi_approve_program = ctx.accounts.token_program.to_account_info();
      let cpi_approve_accounts = Approve {
          to: ctx.accounts.nft_token_account.to_account_info(),
          delegate: ctx.accounts.program_authority.to_account_info(),
          authority: ctx.accounts.user.to_account_info(),
      };

      let cpi_approve_ctx = CpiContext::new(cpi_approve_program, cpi_approve_accounts);
      token::approve(cpi_approve_ctx, 1)?;

      msg!("Freezing token account");
      let authority_bump = StakeBumps::from(ctx.bumps).program_authority;

      let delegated_account = FreezeDelegatedAccount { 
        delegate: ctx.accounts.program_authority.key(), 
        token_account: ctx.accounts.nft_token_account.key(), 
        edition: ctx.accounts.nft_edition.key(), 
        mint: ctx.accounts.nft_mint.key(), 
        token_program: ctx.accounts.token_program.key(), 
      };
      invoke_signed(
          &delegated_account.instruction(),
          &[
              ctx.accounts.program_authority.to_account_info(),
              ctx.accounts.nft_token_account.to_account_info(),
              ctx.accounts.nft_edition.to_account_info(),
              ctx.accounts.nft_mint.to_account_info(),
              ctx.accounts.metadata_program.to_account_info(),
          ],
          &[&[b"authority", &[authority_bump]]],
      )?;

      ctx.accounts.stake_state.token_account = ctx.accounts.nft_token_account.key();
      ctx.accounts.stake_state.user_pubkey = ctx.accounts.user.key();
      ctx.accounts.stake_state.stake_state = StakeState::Staked;
      ctx.accounts.stake_state.stake_start_time = clock.unix_timestamp;
      ctx.accounts.stake_state.last_stake_redeem = clock.unix_timestamp;
      ctx.accounts.stake_state.is_initialized = true;

      msg!("Staking");
      Ok(())
    }

    pub fn redeem(ctx: Context<Redeem>) -> Result<()> {
      require!(
        ctx.accounts.stake_state.is_initialized,
        StakeError::UninitializedAccount
      );
      
      require!(
        ctx.accounts.stake_state.stake_state == StakeState::Staked,
        StakeError::InvalidStakeState
      );

      let clock = Clock::get()?;

      msg!(
        "Stake last redeem: {:?}",
        ctx.accounts.stake_state.last_stake_redeem
      );
      
      msg!("Current time: {:?}", clock.unix_timestamp);
      let unix_time = clock.unix_timestamp - ctx.accounts.stake_state.last_stake_redeem;
      msg!("Seconds since last redeem: {}", unix_time);
      let redeem_amount = (10 * i64::pow(10, 2) * unix_time) / (24 * 60 * 60);
      msg!("Elligible redeem amount: {}", redeem_amount);

      msg!("Minting staking rewards");
      token::mint_to(
          CpiContext::new_with_signer(
              ctx.accounts.token_program.to_account_info(),
              MintTo {
                  mint: ctx.accounts.stake_mint.to_account_info(),
                  to: ctx.accounts.user_stake_ata.to_account_info(),
                  authority: ctx.accounts.stake_authority.to_account_info(),
              },
              &[&[
                  b"mint".as_ref(),
                  &[RedeemBumps::from(ctx.bumps).stake_authority],
              ]],
          ),
          redeem_amount.try_into().unwrap(),
      )?;

      ctx.accounts.stake_state.last_stake_redeem = clock.unix_timestamp;
      msg!(
          "Updated last stake redeem time: {:?}",
          ctx.accounts.stake_state.last_stake_redeem
      );
      Ok(())
    }

    pub fn unstake(ctx: Context<Unstake>) -> Result<()> {
      require!(
        ctx.accounts.stake_state.is_initialized,
        StakeError::UninitializedAccount
      );
      
      require!(
        ctx.accounts.stake_state.stake_state == StakeState::Staked,
        StakeError::InvalidStakeState
      );

      msg!("Thawing token account");
      let authority_bump = UnstakeBumps::from(ctx.bumps).program_authority;

      let delegated_account = ThawDelegatedAccount { 
        delegate: ctx.accounts.program_authority.key(), 
        token_account: ctx.accounts.nft_token_account.key(), 
        edition: ctx.accounts.nft_edition.key(), 
        mint: ctx.accounts.nft_mint.key(), 
        token_program: ctx.accounts.token_program.key(), 
      };
      invoke_signed(
          &delegated_account.instruction(),
          &[
              ctx.accounts.program_authority.to_account_info(),
              ctx.accounts.nft_token_account.to_account_info(),
              ctx.accounts.nft_edition.to_account_info(),
              ctx.accounts.nft_mint.to_account_info(),
              ctx.accounts.metadata_program.to_account_info(),
          ],
          &[&[b"authority", &[authority_bump]]],
      )?;

      msg!("Revoking delegate");

      let cpi_revoke_program = ctx.accounts.token_program.to_account_info();
      let cpi_revoke_accounts = Revoke {
          source: ctx.accounts.nft_token_account.to_account_info(),
          authority: ctx.accounts.user.to_account_info(),
      };

      let cpi_revoke_ctx = CpiContext::new(cpi_revoke_program, cpi_revoke_accounts);
      token::revoke(cpi_revoke_ctx)?;

      ctx.accounts.stake_state.stake_state = StakeState::Unstaked;
      Ok(())
    }
}

#[derive(Accounts)]
pub struct Stake<'info> {
  #[account(mut)]
  pub user: Signer<'info>,

  #[account(
    mut,
    associated_token::mint=nft_mint,
    associated_token::authority=user
  )]
  pub nft_token_account: Account<'info, TokenAccount>,
  pub nft_mint: Account<'info, Mint>,

  /// CHECK: Manual validation
  pub nft_edition: Account<'info, MasterEditionAccount>,

  #[account(
    init_if_needed,
    payer=user,
    space = std::mem::size_of::<UserStakeInfo>() + 8,
    seeds = [user.key().as_ref(), nft_token_account.key().as_ref()],
    bump
  )]
  pub stake_state: Account<'info, UserStakeInfo>,

  /// CHECK: Manual validation
  #[account(mut, seeds=["authority".as_bytes().as_ref()], bump)]
  pub program_authority: UncheckedAccount<'info>,
  pub token_program: Program<'info, Token>,
  pub system_program: Program<'info, System>,
  pub metadata_program: Program<'info, Metadata>,
}

#[derive(Accounts)]
pub struct Redeem<'info> {
  #[account(mut)]
  pub user: Signer<'info>,
  #[account(
      mut,
      token::authority=user
  )]
  pub nft_token_account: Account<'info, TokenAccount>,
  #[account(
      mut,
      seeds = [user.key().as_ref(), nft_token_account.key().as_ref()],
      bump,
      constraint = *user.key == stake_state.user_pubkey,
      constraint = nft_token_account.key() == stake_state.token_account
  )]
  pub stake_state: Account<'info, UserStakeInfo>,
  #[account(mut)]
  pub stake_mint: Account<'info, Mint>,
  /// CHECK: manual check
  #[account(seeds = ["mint".as_bytes().as_ref()], bump)]
  pub stake_authority: UncheckedAccount<'info>,
  #[account(
      init_if_needed,
      payer=user,
      associated_token::mint=stake_mint,
      associated_token::authority=user
  )]
  pub user_stake_ata: Account<'info, TokenAccount>,
  pub token_program: Program<'info, Token>,
  pub associated_token_program: Program<'info, AssociatedToken>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
  #[account(mut)]
  pub user: Signer<'info>,
  #[account(
      mut,
      token::authority=user
  )]
  pub nft_token_account: Account<'info, TokenAccount>,
  pub nft_mint: Account<'info, Mint>,
  /// CHECK: Manual validation
  pub nft_edition: Account<'info, MasterEditionAccount>,
  #[account(
      mut,
      seeds = [user.key().as_ref(), nft_token_account.key().as_ref()],
      bump,
      constraint = *user.key == stake_state.user_pubkey,
      constraint = nft_token_account.key() == stake_state.token_account
  )]
  pub stake_state: Account<'info, UserStakeInfo>,
  /// CHECK: manual check
  #[account(mut, seeds=["authority".as_bytes().as_ref()], bump)]
  pub program_authority: UncheckedAccount<'info>,
  #[account(mut)]
  pub stake_mint: Account<'info, Mint>,
  /// CHECK: manual check
  #[account(seeds = ["mint".as_bytes().as_ref()], bump)]
  pub stake_authority: UncheckedAccount<'info>,
  #[account(
      init_if_needed,
      payer=user,
      associated_token::mint=stake_mint,
      associated_token::authority=user
  )]
  pub user_stake_ata: Account<'info, TokenAccount>,
  pub token_program: Program<'info, Token>,
  pub associated_token_program: Program<'info, AssociatedToken>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
  pub metadata_program: Program<'info, Metadata>,
}

#[account]
pub struct UserStakeInfo {
  pub token_account: Pubkey,
  pub stake_start_time: i64,
  pub last_stake_redeem: i64,
  pub user_pubkey: Pubkey,
  pub stake_state: StakeState,
  pub is_initialized: bool,
}

#[derive(Debug, PartialEq, AnchorDeserialize, AnchorSerialize, Clone)]
pub enum StakeState {
  Unstaked,
  Staked,
}

#[error_code]
pub enum StakeError {
    #[msg("NFT already staked")]
    AlreadyStaked,
    #[msg("State account is uninitialized")]
    UninitializedAccount,

    #[msg("Stake state is invalid")]
    InvalidStakeState,
}