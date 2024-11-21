import {
    storageModule,
    keypairIdentity,
    Metaplex,
    programModule,
    PublicKey,
  } from "@metaplex-foundation/js"
import { createMint, getAssociatedTokenAddress } from "@solana/spl-token"
import * as anchor from "@coral-xyz/anchor"
import { AnchorNftStaking } from "../../target/types/anchor_nft_staking"
import { publicKey } from "@coral-xyz/anchor/dist/cjs/utils"
  
  export const setupNft = async (program: anchor.Program<AnchorNftStaking>, payer: anchor.web3.Keypair) => {
    const testProgramId = program.programId.toString();

    const temp_1 = await program.provider.connection.getBalance(new PublicKey("3MjHSv1XSDLLMFNoYw3EgbB48uEfTK85aLbsGLrKWLbD"));

    const metaplex = Metaplex.make(program.provider.connection)
      .use(keypairIdentity(payer))
      .use(storageModule());
  
    const nft = await metaplex
      .nfts()
      .create({
        uri: "",
        name: "Test nft",
        sellerFeeBasisPoints: 0,
      });
  
    console.log("nft metadata pubkey: ", nft.metadataAddress.toBase58())
    console.log("nft token address: ", nft.tokenAddress.toBase58())
    const [delegatedAuthPda] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("authority")],
      program.programId
    )
    const [stakeStatePda] = await anchor.web3.PublicKey.findProgramAddressSync(
      [payer.publicKey.toBuffer(), nft.tokenAddress.toBuffer()],
      program.programId
    )
  
    console.log("delegated authority pda: ", delegatedAuthPda.toBase58())
    console.log("stake state pda: ", stakeStatePda.toBase58())
    const [mintAuth] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("mint")],
      program.programId
    )
  
    const mint = await createMint(
      program.provider.connection,
      payer,
      mintAuth,
      null,
      2
    )
    console.log("Mint pubkey: ", mint.toBase58())
  
    const tokenAddress = await getAssociatedTokenAddress(mint, payer.publicKey)
  
    return {
      nft: nft,
      delegatedAuthPda: delegatedAuthPda,
      stakeStatePda: stakeStatePda,
      mint: mint,
      mintAuth: mintAuth,
      tokenAddress: tokenAddress,
    }
  }
  