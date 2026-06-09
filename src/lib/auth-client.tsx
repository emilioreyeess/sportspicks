/**
 * Shim de compatibilidad CLIENTE para sustituir a `next-auth/react`.
 * ───────────────────────────────────────────────────────────────────────────
 * Expone la MISMA API que consumían los componentes (`useSession`, `signIn`,
 * `signOut`) pero respaldada por Supabase Auth (@supabase/ssr). Así los
 * componentes solo cambian la ruta del import: el cuerpo (`data: session`,
 * `status`, `signIn("google")`, `signOut()`) queda idéntico.
 *
 * Forma de la sesión compat: { user: { email, name, image } }
 */
"use client"

import { createContext, useContext, useEffect, useState, useMemo } from "react"
import { createBrowserSupabase } from "@/lib/supabase/browser"
import type { User } from "@supabase/supabase-js"

export interface CompatSession {
  user: { email: string; name: string | null; image: string | null }
}
type Status = "loading" | "authenticated" | "unauthenticated"

function toSession(user: User | null | undefined): CompatSession | null {
  if (!user?.email) return null
  const meta = (user.user_metadata ?? {}) as Record<string, any>
  return {
    user: {
      email: user.email,
      name: meta.full_name ?? meta.name ?? null,
      image: meta.avatar_url ?? meta.picture ?? null,
    },
  }
}

const AuthContext = createContext<{ session: CompatSession | null; status: Status }>({
  session: null,
  status: "loading",
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<CompatSession | null>(null)
  const [status, setStatus] = useState<Status>("loading")

  useEffect(() => {
    const supabase = createBrowserSupabase()
    let active = true

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      const s = toSession(data?.user)
      setSession(s)
      setStatus(s ? "authenticated" : "unauthenticated")
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      const s = toSession(sess?.user)
      setSession(s)
      setStatus(s ? "authenticated" : "unauthenticated")
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => ({ session, status }), [session, status])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Compat de next-auth: { data, status }. */
export function useSession(): { data: CompatSession | null; status: Status } {
  const { session, status } = useContext(AuthContext)
  return { data: session, status }
}

/**
 * Compat de next-auth signIn().
 *  - signIn("google", { callbackUrl }) → OAuth redirect (Supabase).
 *  - signIn("credentials", { email, password, name, mode, redirect:false })
 *      → signInWithPassword / signUp. Devuelve { error?, ok? }.
 */
export async function signIn(
  provider: string,
  opts: Record<string, any> = {},
): Promise<{ error?: string; ok?: boolean } | undefined> {
  const supabase = createBrowserSupabase()
  const origin = typeof window !== "undefined" ? window.location.origin : ""

  if (provider === "google") {
    // redirectTo LIMPIO, sin query string: debe coincidir EXACTAMENTE con la
    // entrada de la allow-list de Supabase (".../auth/callback"). Un "?next=…"
    // rompe el match exacto → Supabase cae al Site URL y el code nunca llega a
    // /auth/callback. El destino tras el login se gestiona en el callback (→ "/").
    // skipBrowserRedirect: NO delegamos la navegación en supabase-js (en algunos
    // entornos no dispara window.location y el clic queda en un no-op silencioso).
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
        skipBrowserRedirect: true,
      },
    })
    if (error) {
      console.error("[auth] signInWithOAuth error:", error.message)
      return { error: error.message }
    }
    if (data?.url) {
      window.location.href = data.url // redirección explícita a Google/Supabase
      return { ok: true }
    }
    console.error("[auth] signInWithOAuth no devolvió URL de autorización")
    return { error: "NoOAuthUrl" }
  }

  if (provider === "credentials") {
    const mode = opts.mode === "register" ? "register" : "login"
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: opts.email,
        password: opts.password,
      })
      if (error) return { error: "CredentialsSignin" }
      return { ok: true }
    }
    // register
    const { data, error } = await supabase.auth.signUp({
      email: opts.email,
      password: opts.password,
      options: {
        data: { full_name: opts.name ?? "" },
        emailRedirectTo: `${origin}/auth/callback`,
      },
    })
    if (error) return { error: error.message }
    // Supabase ofusca emails ya registrados con identities vacío.
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { error: "EMAIL_TAKEN" }
    }
    return { ok: true }
  }

  return { error: "UnsupportedProvider" }
}

/**
 * Compat de next-auth getProviders(): la app solo lo usa para decidir si pinta
 * el botón de Google. Devolvemos los proveedores activos de forma estática.
 */
export async function getProviders(): Promise<Record<string, { id: string; name: string }>> {
  return {
    google: { id: "google", name: "Google" },
    credentials: { id: "credentials", name: "Credentials" },
  }
}

/** Compat de next-auth signOut(): cierra sesión Supabase y redirige. */
export async function signOut(opts: { callbackUrl?: string } = {}): Promise<void> {
  const supabase = createBrowserSupabase()
  await supabase.auth.signOut()
  if (typeof window !== "undefined") {
    window.location.href = opts.callbackUrl ?? "/"
  }
}
