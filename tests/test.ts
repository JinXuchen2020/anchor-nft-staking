import * as anchor from "@coral-xyz/anchor"
import { setupNft } from "./utils/setupNft";
import { CreateCompressedNftOutput, PublicKey } from "@metaplex-foundation/js";
import assert from "assert"

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import { MPL_TOKEN_METADATA_PROGRAM_ID as METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata"

describe("NFT Staking Tests", async () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider); 

  let delegatedAuthPda: anchor.web3.PublicKey;
  let stakeStatePda: anchor.web3.PublicKey;
  let nft: CreateCompressedNftOutput;
  let mintAuth: anchor.web3.PublicKey;
  let mint: anchor.web3.PublicKey;
  let tokenAddress: anchor.web3.PublicKey;

  const wallet = anchor.workspace.AnchorNftStaking.provider.wallet;
  const program = anchor.workspace.AnchorNftStaking;

  before(async () => { 
    ;({ nft, delegatedAuthPda, stakeStatePda, mint, mintAuth, tokenAddress } =
      await setupNft(program, wallet.payer));
  });

  it("stake", async () => {
    await program.methods
      .stake()
      .accounts({
        nftTokenAccount: nft.tokenAddress,
        nftMint: nft.mintAddress,
        nftEdition: nft.masterEditionAddress,
        metadataProgram: METADATA_PROGRAM_ID,
      })
      .rpc();
    const account = await program.account.userStakeInfo.fetch(stakeStatePda);
    assert.ok(account.stakeState === "Staked");
  });

  it("Redeems", async () => {
    await program.methods
      .redeem()
      .accounts({
        nftTokenAccount: nft.tokenAddress,
        stakeMint: mint,
        userStakeAta: tokenAddress,
      })
      .rpc();
    const account = await program.account.userStakeInfo.fetch(stakeStatePda)
    assert.ok(account.stakeState === "Unstaked")
  });

  it("Unstakes", async () => {
    await program.methods
      .unstake()
      .accounts({
        nftTokenAccount: nft.tokenAddress,
        nftMint: nft.mintAddress,
        nftEdition: nft.masterEditionAddress,
        metadataProgram: METADATA_PROGRAM_ID,
        stakeMint: mint,
        userStakeAta: tokenAddress,
      })
      .rpc()
    const account = await program.account.userStakeInfo.fetch(stakeStatePda)
    assert.ok(account.stakeState === "Unstaked")
  });
  
});