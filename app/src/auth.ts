import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { SigninMessage } from "./utils/SignInMessage"
 
export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    GitHub, 
    Google,
    CredentialsProvider({
      name: "Solana",
      credentials: {
        mesage: { label: "Message", type: "text" },
        signature: { label: "Signature", type: "text" },
      },
      async authorize(credentials: any, req) {
        // You need to provide your own logic here to look up the user from the credentials
        try {
          const signinMessage = new SigninMessage(
            JSON.parse(credentials?.message || "{}")
          );
          const nextAuthUrl = new URL(process.env.NEXTAUTH_URL!);
          if (signinMessage.domain !== nextAuthUrl.host) {
            return null;
          }

          const csrfToken = req.headers.get('cookie')?.split('; ')[0].split('=')[1].split("%")[0];

          if (signinMessage.nonce !== csrfToken) {
            return null;
          }

          const validationResult = await signinMessage.validate(
            credentials?.signature || ""
          );

          if (!validationResult)
            throw new Error("Could not validate the signed message");

          return {
            id: signinMessage.publicKey,
          };
        } catch (e: Error) {
          throw new Error(`${e.me}`);
        }
      },
    }),
  ],
  session:{
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async session({session, token}) {
      // @ts-ignore
      session.publicKey = token.sub;
      if (session.user) {
        session.user.name = token.sub;
        session.user.image = `https://ui-avatars.com/api/?name=${token.sub}&background=random`;
      }
      return session;
    },
  },
})