"use client"
/**
 * Lightweight auth — stores user email in localStorage.
 * Enforces a login wall before any content is shown.
 * Email is used for Stripe checkout without re-prompting.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

const AUTH_KEY = "sp_auth_user"

export interface AuthUser {
  email: string
  name?: string
  loggedInAt: string
}

interface AuthContextValue {
  user: AuthUser | null
  login: (email: string, name?: string) => void
  logout: () => void
  ready: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.email) return null
    return parsed as AuthUser
  } catch { return null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setUser(readStoredUser())
    setReady(true)
  }, [])

  const login = useCallback((email: string, name?: string) => {
    const u: AuthUser = { email: email.toLowerCase().trim(), name, loggedInAt: new Date().toISOString() }
    setUser(u)
    try { localStorage.setItem(AUTH_KEY, JSON.stringify(u)) } catch {}
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    try { localStorage.removeItem(AUTH_KEY) } catch {}
  }, [])

  const value = useMemo(() => ({ user, login, logout, ready }), [user, login, logout, ready])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) return { user: null, login: () => {}, logout: () => {}, ready: true }
  return ctx
}
