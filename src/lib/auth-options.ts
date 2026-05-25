import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"

/**
 * NextAuth config — centralizado aquí para no contaminar la Route con exports extra.
 * Next.js App Router solo permite GET/POST/etc. como exports en route files.
 */
const providers: NextAuthOptions["providers"] = []

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
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
        token.email    = user.email
        token.name     = user.name
        token.image    = user.image
        token.provider = account?.provider
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string
        session.user.name  = token.name  as string
        session.user.image = token.image as string
      }
      return session
    },
  },
  pages: {
    signIn: "/auth/signin",
    error:  "/auth/signin",
  },
}
