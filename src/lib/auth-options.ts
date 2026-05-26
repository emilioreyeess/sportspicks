import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { getGrantedPlan } from "@/lib/plan-grants"

/**
 * NextAuth config — centralizado aquí para no contaminar la Route con exports extra.
 * Next.js App Router solo permite GET/POST/etc. como exports en route files.
 *
 * El plan se inyecta en el JWT durante el sign-in:
 *   1. Grant manual (plan-grants.ts) — equipo / beta testers
 *   2. "free" como fallback (Stripe se verifica en /api/auth/plan si hace falta)
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

        // Inyectar plan en el JWT en el momento del login
        // El cliente siempre puede re-verificar via /api/auth/plan
        const grant = user.email ? getGrantedPlan(user.email) : null
        token.plan = grant ?? "free"
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string
        session.user.name  = token.name  as string
        session.user.image = token.image as string
        ;(session.user as any).plan = token.plan ?? "free"
      }
      return session
    },
  },
  pages: {
    signIn: "/auth/signin",
    error:  "/auth/signin",
  },
}
