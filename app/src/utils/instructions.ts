import { PublicKey } from "@solana/web3.js"
import { getProgramPdaAddresses } from "./accounts"
import { Program } from "@coral-xyz/anchor"
import { AnchorNftStaking } from "./anchor_nft_staking"

export const createStakeIx = async (
  program: Program<AnchorNftStaking>,
  staker: PublicKey,
  nftMint: PublicKey
) => {
  const { userNftAccount } = await getProgramPdaAddresses(
    program,
    staker,
    nftMint
  )

  const ix = await program.methods
    .stake()
    .accounts({
      nftEdition: userNftAccount,
      nftMint: nftMint,
    })
    .instruction()

  return ix
}

export const createRedeemIx = async (
  program: Program<AnchorNftStaking>,
  nftMint: PublicKey
) => {
  const ix = await program.methods
    .redeem()
    .accounts({
      nftTokenAccount: nftMint,
      stakeMint: nftMint, // Assuming stakeMint is the same as nftMint for this example
    })
    .instruction()

  return ix
}

export const createUnstakeIx = async (
  program: Program<AnchorNftStaking>,
  staker: PublicKey,
  nftMint: PublicKey
) => {
  const { userNftAccount, pdaNftAccount } = await getProgramPdaAddresses(
    program,
    staker,
    nftMint
  )

  const ix = await program.methods
    .unstake()
    .accounts({
      nftTokenAccount: userNftAccount,
      nftEdition: pdaNftAccount,
      nftMint: nftMint,
      stakeMint: nftMint, // Assuming stakeMint is the same as nftMint for this example
    })
    .instruction()

  return ix
}
