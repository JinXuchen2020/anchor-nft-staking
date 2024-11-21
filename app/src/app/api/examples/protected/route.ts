import { auth } from "@/auth";
import type { NextApiRequest, NextApiResponse } from "next";

const secret = process.env.NEXTAUTH_SECRET;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {

  const session = await auth(req, res);
  if (!session){
    return res.send({
      error: "User wallet not authenticated",
    });
  }
  else {
    return res.send({
      content:
        "This is protected content. You can access this content because you are signed in with your Solana Wallet.",
    });
  }
}