import { Program, utils } from "@coral-xyz/anchor"
import { AnchorNftStaking } from "./anchor_nft_staking"
import { Metadata, Metaplex, PublicKey } from "@metaplex-foundation/js"
import { getAssociatedTokenAddress } from "@solana/spl-token"
import { Connection } from "@solana/web3.js"

export async function getStakeAccount(
  program: Program<AnchorNftStaking>,
  user: PublicKey,
  tokenAccount: PublicKey
): Promise<StakeAccount> {
  const [pda] = PublicKey.findProgramAddressSync(
    [user.toBuffer(), tokenAccount.toBuffer()],
    program.programId
  )

  const account = await program.account.userStakeInfo.fetch(pda)
  return account
}

interface StakeAccount {
  tokenAccount: PublicKey,
  stakeStartTime: number,
  lastStakeRedeem: number,
  userPubkey: PublicKey,
  stakeState: StakeState,
  isInitialized: boolean,
}

enum StakeState {
  Unstaked = 0,
  Staked = 1,
}

export const getUserInfo = async (
  program: Program<AnchorNftStaking>,
  userPubkey: PublicKey
) => {
  const [userInfo, _userInfoBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), userPubkey.toBuffer()],
    program.programId
  )
  try {
    const userInfoData = await program.account.userStakeInfo.fetch(userInfo)
    return userInfoData
  } catch (error) {
    console.log(error)
    return null
  }
}

export const getAllUserStakeInfo = async (
  program: Program<AnchorNftStaking>,
  userPubkey: PublicKey
) => {
  const filter = [
    {
      memcmp: {
        offset: 8, //prepend for anchor's discriminator & tokenAccount
        bytes: userPubkey.toBase58(),
      },
    },
  ]
  const res = await program.account.userStakeInfo.all(filter)
  const metaplex = new Metaplex(program.provider.connection)
  const data = await Promise.all(
    res.map(async (item) => {
      const tokenInfo = await metaplex
        .nfts()
        .findByMint({ mintAddress: item.account.tokenAccount })
      return { pdaInfo: item, tokenInfo }
    })
  )
  return data
}

const COLLECTION_MINT = process.env.NEXT_PUBLIC_COLLECTION_MINT

export const getAllNftsOwnedByUser = async (
  connection: Connection,
  userPubkey: PublicKey
) => {
  const metaplex = new Metaplex(connection)

  const allNfts = await metaplex.nfts().findAllByOwner({ owner: userPubkey })
  const eligibleMints = allNfts.filter(
    (nft) => COLLECTION_MINT === nft.collection?.address.toString()
  )
  const data = await Promise.all(
    eligibleMints.map(
      async (item) =>
        await metaplex
          .nfts()
          .findByMint({ mintAddress: (item as Metadata).mintAddress })
    )
  )
  return data
}

export const getProgramPdaAddresses = async (
  program: Program<AnchorNftStaking>,
  staker: PublicKey,
  mint: PublicKey
) => {
  const metaplex = new Metaplex(program.provider.connection)

  // Fetch the metadata address for the given mint address. This is necessary to identify the NFT.
  const { metadataAddress } = await metaplex
    .nfts()
    .findByMint({ mintAddress: mint })

  const [userStakeInfo, _userStakeInfoBump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(utils.bytes.utf8.encode("stake_info")),
      staker.toBuffer(),
      mint.toBuffer(),
    ],
    program.programId
  )

  // Fetch the associated token account for the user's NFT. This is where the NFT is stored in the user's wallet.
  const nftTokenAccount = await getAssociatedTokenAddress(mint, staker)

  // Fetch the associated token account for the PDA (Program Derived Address) that will hold the NFT when it is staked. This is where the NFT will be transferred when the user stakes it. The third parameter `true` indicates that this is a PDA.
  const pdaNftAccount = await getAssociatedTokenAddress(
    mint,
    userStakeInfo,
    true
  )

  const [userInfo, _userInfoBump] = PublicKey.findProgramAddressSync(
    [Buffer.from(utils.bytes.utf8.encode("user")), staker.toBuffer()],
    program.programId
  )

  return {
    metadataAddress,
    userNftAccount: nftTokenAccount,
    pdaNftAccount,
    userStakeInfo,
    userInfo,
  }
}
