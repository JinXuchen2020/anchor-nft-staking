
import { Connection, Transaction } from "@solana/web3.js"
import { AnchorWallet } from "@solana/wallet-adapter-react"

export const signAndSendTx = async (
  connection: Connection,
  tx: Transaction,
  wallet: AnchorWallet
) => {
  tx.recentBlockhash = (
    await connection.getLatestBlockhash("singleGossip")
  ).blockhash
  tx.feePayer = wallet.publicKey
  const signedTx = await wallet.signTransaction(tx)
  const rawTransaction = signedTx.serialize()
  const txSig = await connection.sendRawTransaction(rawTransaction)

  const latestBlockHash = await connection.getLatestBlockhash()

  await connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: txSig,
  })

  return txSig
}
