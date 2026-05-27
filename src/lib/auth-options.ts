import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { scryptSync, randomBytes, timingSafeEqual } from "crypto"
import { getGrantedPlan } from "@/lib/plan-grants"

function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return { hash, salt }
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const derived = scryptSync(password, salt, 64)
    return timingSafeEqual(derived, Buffer.from(hash, "hex"))
  } catch {
    return false
  }
}

async function upsertUserToSupabase(user: {
  email: string | null | undefined
  name: string | null | undefined
  image: string | null | undefined
  provider: string | undefined
}) {
  if (!user.email) return
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("[users_log] Missing env vars — SUPABASE_URL:", !!url, "SERVICE_ROLE_KEY:", !!key)
    return
  }
  // CN-027: Mask email in logs to avoid PII leakage
  const maskedEmail = user.email ? user.email.slice(0, 3) + "***" : "unknown"
  console.log("[users_log] Attempting upsert for:", maskedEmail)

  try {
    const { createClient } = await import("@supabase/supabase-js")
    const sb = createClient(url, key, { auth: { persistSession: false } })
    const { error } = await sb.from("users_log").upsert({
      email:      user.email,
      name:       user.name ?? null,
      avatar_url: user.image ?? null,
      provider:   user.provider ?? "google",
      last_sign_in: new Date().toISOString(),
    }, { onConflict: "email", ignoreDuplicates: false })
    if (error) console.error("[users_log] Supabase error:", error.message)
    else console.log("[users_log] Usuario guardado:", maskedEmail)
  } catch (e) {
    console.error("[users_log] Exception:", e)
  }
}

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

providers.push(
  CredentialsProvider({
    id: "credentials",
    name: "Email y contraseña",
    credentials: {
      email:    { label: "Email",        type: "email"    },
      password: { label: "Contraseña",   type: "password" },
      name:     { label: "Nombre",       type: "text"     },
      mode:     { label: "Modo",         type: "text"     }, // "login" | "register"
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null

      const email    = credentials.email.toLowerCase().trim()
      const password = credentials.password
      const mode     = credentials.mode ?? "login"

      if (password.length < 8) return null

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!url || !key) return null

      const { createClient } = await import("@supabase/supabase-js")
      const sb = createClient(url, key, { auth: { persistSession: false } })

      const { data: existing } = await sb
        .from("users_log")
        .select("email, name, avatar_url, password_hash, password_salt")
        .eq("email", email)
        .maybeSingle()

      if (mode === "register") {
        if (existing) throw new Error("EMAIL_TAKEN")
        const { hash, salt } = hashPassword(password)
        const displayName = credentials.name?.trim() || email.split("@")[0]
        const { error } = await sb.from("users_log").insert({
          email,
          name:          displayName,
          provider:      "credentials",
          password_hash: hash,
          password_salt: salt,
          last_sign_in:  new Date().toISOString(),
        })
        if (error) return null
        return { id: email, email, name: displayName, image: null }
      }

      // Login
      if (!existing?.password_hash || !existing?.password_salt) return null
      if (!verifyPassword(password, existing.password_hash, existing.password_salt)) return null

      await sb.from("users_log")
        .update({ last_sign_in: new Date().toISOString() })
        .eq("email", email)

      return { id: email, email, name: existing.name, image: existing.avatar_url }
    },
  })
)

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
        const grant = user.email ? getGrantedPlan(user.email) : null
        token.plan = grant ?? "free"

        // Guardar usuario en Supabase (awaited — serverless kills fire-and-forget)
        await upsertUserToSupabase({
          email:    user.email,
          name:     user.name,
          image:    user.image,
          provider: account?.provider,
        })
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
