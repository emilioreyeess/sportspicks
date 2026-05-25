import NextAuth, { type NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import AppleProvider from "next-auth/providers/apple"

/**
 * NextAuth config — Google + Apple Sign-In.
 * Env vars needed:
 *   NEXTAUTH_SECRET          (random string, already set)
 *   NEXTAUTH_URL             https://sportspicks.vercel.app
 *   GOOGLE_CLIENT_ID         from Google Cloud Console
 *   GOOGLE_CLIENT_SECRET     from Google Cloud Console
 *   APPLE_ID                 com.sportspicks.app  (optional)
 *   APPLE_TEAM_ID            (optional)
 *   APPLE_PRIVATE_KEY        (optional)
 *   APPLE_KEY_ID             (optional)
 */

const providers: NextAuthOptions["providers"] = []

// Google — only add if credentials are configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  )
}

// Apple — only add if credentials are configured
if (
  process.env.APPLE_ID &&
  process.env.APPLE_TEAM_ID &&
  process.env.APPLE_PRIVATE_KEY &&
  process.env.APPLE_KEY_ID
) {
  providers.push(
    AppleProvider({
      clientId: process.env.APPLE_ID,
      clientSecret: {
        appleId: process.env.APPLE_ID,
        teamId: process.env.APPLE_TEAM_ID,
        privateKey: process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        keyId: process.env.APPLE_KEY_ID,
      } as any,
    })
  )
}

export const authOptions: NextAuthOptions = {
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.email = user.email
        token.name  = user.name
        token.image = user.image
        token.provider = account?.provider
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string
        session.user.name  = token.name  as string
        session.user.image = token.image as string
        ;(session as any).provider = token.provider
      }
      return session
    },
  },
  pages: {
    signIn: "/auth/signin",   // custom login page
    error:  "/auth/error",
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
