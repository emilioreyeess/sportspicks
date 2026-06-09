"use client"
import { AuthProvider } from "@/lib/auth-client"

export function SessionWrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
