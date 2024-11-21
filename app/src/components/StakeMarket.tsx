import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"
import {
  HeaderContainer,
  HeaderInfo,
  HeaderInfoContainer,
  HeaderTitle,
  HomeContainer,
  ImageButton,
  ImageCard,
  Vault,
  VaultContainer,
  VaultItems,
  VaultTitle,
} from "@/styles/home"
import { use, useEffect, useState } from "react"
import { PublicKey, Transaction } from "@solana/web3.js"
import {
  getAllNftsOwnedByUser,
  getAllUserStakeInfo,
  getUserInfo,
} from "@/utils/accounts"
import {
  createRedeemIx,
  createStakeIx,
  createUnstakeIx,
} from "@/utils/instructions"
import { signAndSendTx } from "@/utils/transactions"
import { IdlAccounts, Program, ProgramAccount } from "@coral-xyz/anchor"
import Image from "next/image"
import { AnchorNftStaking, IDL } from "@/utils/anchor_nft_staking"
import { Nft, NftWithToken, Sft, SftWithToken } from "@metaplex-foundation/js"
import { useWorkspace } from "@/context/anchor"

type UserStakeInfoStruct = IdlAccounts<AnchorNftStaking>["userStakeInfo"]
interface UserStakeInfoType {
  pdaInfo: ProgramAccount<UserStakeInfoStruct>
  tokenInfo: Sft | SftWithToken | Nft | NftWithToken
}

export const StakeMarket = () => {
  const [mintsInWallet, setMintsInWallet] = useState<
    (Sft | SftWithToken | Nft | NftWithToken)[]
  >([])
  const [nftStakingProgram, setNftStakingProgram] =
    useState<Program<AnchorNftStaking> | null>(null)
  const [allUserStakeInfo, setAllUserStakeInfo] = useState<
    UserStakeInfoType[] | null
  >(null)
  const { connection } = useConnection()
  const wallet = useAnchorWallet()

  const workspace = useWorkspace();

  useEffect(() => {
    if (wallet) {
      ;(async () => {
        if (!workspace.program) return;
        const allUserStakeInfo = await getAllUserStakeInfo(
          workspace.program,
          wallet.publicKey
        )

        setAllUserStakeInfo(allUserStakeInfo)
        const eligibleMints = await getAllNftsOwnedByUser(
          workspace.program.provider.connection,
          wallet.publicKey
        )
        setMintsInWallet(eligibleMints)
      })()
    }
  }, [wallet])

  // Allow user to select a mint and stake

  const handleStake = async (mint: PublicKey) => {
    if (wallet && workspace.program && mint) {
      const stakeIx = await createStakeIx(
        workspace.program,
        wallet.publicKey,
        mint // Selected Mint
      )

      const tx = new Transaction()
      tx.add(stakeIx)
      const txSig = await signAndSendTx(connection, tx, wallet)
      console.log(`https://solscan.io/tx/${txSig}?cluster=devnet`)
      const allUserStakeInfo = await getAllUserStakeInfo(
        workspace.program,
        wallet.publicKey
      )

      setAllUserStakeInfo(allUserStakeInfo)
      const eligibleMint = await getAllNftsOwnedByUser(
        workspace.program.provider.connection,
        wallet.publicKey
      )
      setMintsInWallet(eligibleMint)
    }
  }
  const handleRedeem = async (mint: PublicKey) => {
    if (wallet && workspace.program && mint) {
      const stakeIx = await createRedeemIx(workspace.program, mint)

      const tx = new Transaction()
      tx.add(stakeIx)
      const txSig = await signAndSendTx(connection, tx, wallet)
      console.log(`https://solscan.io/tx/${txSig}?cluster=devnet`)
      // const userInfo = await getUserInfo(workspace.program, wallet.publicKey)
      // setUserInfo(userInfo)
    }
  }
  const handleUnstake = async (mint: PublicKey) => {
    if (wallet && workspace.program && mint) {
      const stakeIx = await createUnstakeIx(
        workspace.program,
        wallet.publicKey,
        mint
      )

      const tx = new Transaction()
      tx.add(stakeIx)
      const txSig = await signAndSendTx(connection, tx, wallet)
      console.log(`https://solscan.io/tx/${txSig}?cluster=devnet`)
      const allUserStakeInfo = await getAllUserStakeInfo(
        workspace.program,
        wallet.publicKey
      )
      setAllUserStakeInfo(allUserStakeInfo)
      const eligibleMint = await getAllNftsOwnedByUser(
        workspace.program.provider.connection,
        wallet.publicKey
      )
      setMintsInWallet(eligibleMint)
      // const userInfo = await getUserInfo(nftStakingProgram, wallet.publicKey)
      // setUserInfo(userInfo)
    }
  }

  return (
    <HomeContainer>
      <HeaderContainer>
        <HeaderInfoContainer>
          <HeaderTitle>NFT Staking Protocol</HeaderTitle>
          {/* {userInfo && (
            <HeaderInfo>{`Total Rewards: ${userInfo.pointBalance}`}</HeaderInfo>
          )} */}
        </HeaderInfoContainer>
      </HeaderContainer>
      <VaultContainer>
        <Vault>
          <VaultTitle>Wallet</VaultTitle>
          <VaultItems>
            {mintsInWallet &&
              mintsInWallet.map((mintInfo, key) => (
                <ImageCard key={key}>
                  <Image
                    src={mintInfo.json?.image || ""}
                    alt={mintInfo.name}
                    width={240}
                    height={240}
                  />
                  <ImageButton
                    onClick={() => handleStake(mintInfo.mint.address)}
                  >
                    Stake
                  </ImageButton>
                </ImageCard>
              ))}
          </VaultItems>
        </Vault>
        <Vault>
          <VaultTitle>Vault</VaultTitle>
          <VaultItems>
            {allUserStakeInfo &&
              allUserStakeInfo.map(
                (userStakeInfo, key) =>
                  Object.keys(
                    userStakeInfo.pdaInfo.account.stakeState
                  ).includes("staked") && (
                    <ImageCard key={key}>
                      <Image
                        src={userStakeInfo.tokenInfo.json?.image || ""}
                        alt={userStakeInfo.tokenInfo.name}
                        width={240}
                        height={240}
                      />
                      <ImageButton
                        onClick={() =>
                          handleUnstake(userStakeInfo.pdaInfo.account.tokenAccount)
                        }
                      >
                        Unstake
                      </ImageButton>
                      <ImageButton
                        onClick={() =>
                          handleRedeem(userStakeInfo.pdaInfo.account.tokenAccount)
                        }
                      >
                        Redeem
                      </ImageButton>
                    </ImageCard>
                  )
              )}
          </VaultItems>
        </Vault>
      </VaultContainer>
    </HomeContainer>
  )
}
