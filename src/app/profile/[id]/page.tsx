"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"

interface PublicProfile {
  id: number
  name: string
  avatar_url: string | null
  plan: string
  is_vip_tipster: boolean
  member_since: string | null
  days_member: number
  sign_in_count: number
  stats: {
    total_settled: number
    won: number
    winrate: number
    yield: number
    profit: number
    favorite_sport: string | null
  }
}

const PLAN_BADGE: Record<string, { label: string; cls: string }> = {
  pro:     { label: "PRO",     cls: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  premium: { label: "PREMIUM", cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  free:    { label: "FREE",    cls: "bg-zinc-700/60 text-zinc-400 border-zinc-600/40" },
}

const SPORT_EMOJI: Record<string, string> = {
  football: "⚽", basketball: "🏀", tennis: "🎾", baseball: "⚾", hockey: "🏒", other: "🏅",
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-zinc-800/60 rounded-xl p-3 text-center border border-zinc-700/40">
      <p className={`text-xl font-black ${color ?? "text-white"}`}>{value}</p>
      <p className="text-[10px] text-zinc-500 mt-0.5 uppercase">{label}</p>
      {sub && <p className="text-[9px] text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function PublicProfilePage() {
  const params = useParams()
  const id = params?.id as string

  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/profile/${id}`)
      .then(r => {
        if (!r.ok) { setNotFound(true); return null }
        return r.json()
      })
      .then(d => { if (d) setProfile(d) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="safe-x pb-24 flex flex-col items-center pt-20 gap-4">
        <div className="w-20 h-20 rounded-full bg-zinc-800 animate-pulse" />
        <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse" />
        <div className="h-3 w-24 bg-zinc-800 rounded animate-pulse" />
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="safe-x pb-24 flex flex-col items-center justify-center pt-24 text-center px-6">
        <p className="text-4xl mb-3">🕵️</p>
        <h1 className="text-lg font-black text-white">Perfil no encontrado</h1>
        <p className="text-sm text-zinc-500 mt-1">Este usuario no existe o su perfil no está disponible.</p>
        <Link href="/" className="mt-6 px-4 py-2 rounded-xl bg-zinc-800 text-sm font-bold text-white tap">
          Volver al inicio
        </Link>
      </div>
    )
  }

  const plan = PLAN_BADGE[profile.plan] ?? PLAN_BADGE.free
  const memberSinceYear = profile.member_since
    ? new Date(profile.member_since).getFullYear()
    : null
  const memberSinceMonth = profile.member_since
    ? new Date(profile.member_since).toLocaleDateString("es-ES", { month: "long", year: "numeric" })
    : null

  return (
    <div className="safe-x pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <Link href="/bets" className="text-xs text-zinc-500 hover:text-zinc-300 tap">
          ← Volver
        </Link>
      </div>

      {/* Avatar + name */}
      <div className="flex flex-col items-center px-4 pt-4 pb-6">
        <div className="relative mb-3">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.name}
              width={80}
              height={80}
              className="rounded-full border-2 border-zinc-700"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-2xl font-black text-zinc-400">
              {profile.name.charAt(0).toUpperCase()}
            </div>
          )}
          {profile.is_vip_tipster && (
            <span className="absolute -bottom-1 -right-1 text-sm bg-zinc-900 rounded-full border border-emerald-700/40 px-1.5 py-0.5 text-emerald-400 font-black text-[9px]">
              ✓ TIPSTER
            </span>
          )}
        </div>

        <h1 className="text-xl font-black text-white text-center">{profile.name}</h1>

        <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${plan.cls}`}>
            {plan.label}
          </span>
          {profile.is_vip_tipster && (
            <span className="text-[10px] font-black px-2.5 py-1 rounded-full border bg-emerald-500/15 text-emerald-300 border-emerald-700/40">
              ✓ Tipster verificado
            </span>
          )}
        </div>

        {memberSinceMonth && (
          <p className="text-xs text-zinc-500 mt-2 text-center">
            Miembro desde {memberSinceMonth} · {profile.days_member} días en SportsPicks
          </p>
        )}
      </div>

      {/* Stats */}
      {profile.stats.total_settled > 0 ? (
        <section className="mx-4 mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-zinc-800/60">
            <p className="text-sm font-black text-white">Estadísticas públicas</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Basadas en apuestas registradas y resueltas</p>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Stat
              label="Apuestas resueltas"
              value={String(profile.stats.total_settled)}
            />
            <Stat
              label="Ganadas"
              value={`${profile.stats.won} / ${profile.stats.total_settled}`}
              color="text-emerald-400"
            />
            <Stat
              label="Winrate"
              value={`${profile.stats.winrate}%`}
              color={profile.stats.winrate >= 55 ? "text-emerald-400" : profile.stats.winrate >= 45 ? "text-amber-400" : "text-rose-400"}
            />
            <Stat
              label="Yield"
              value={`${profile.stats.yield > 0 ? "+" : ""}${profile.stats.yield}%`}
              color={profile.stats.yield > 0 ? "text-emerald-400" : "text-rose-400"}
            />
            <Stat
              label="Profit total"
              value={`${profile.stats.profit > 0 ? "+" : ""}${profile.stats.profit.toFixed(2)}€`}
              color={profile.stats.profit > 0 ? "text-emerald-400" : "text-rose-400"}
            />
            {profile.stats.favorite_sport && (
              <Stat
                label="Deporte favorito"
                value={SPORT_EMOJI[profile.stats.favorite_sport] ?? "🏅"}
                sub={profile.stats.favorite_sport}
              />
            )}
          </div>
        </section>
      ) : (
        <div className="mx-4 mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-8 text-center">
          <p className="text-sm font-bold text-zinc-500">Sin apuestas registradas aún</p>
          <p className="text-xs text-zinc-600 mt-1">Las estadísticas se actualizan conforme se resuelven apuestas.</p>
        </div>
      )}

      {/* Activity */}
      <section className="mx-4 mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-5 py-4 flex items-center gap-4">
        <div className="grid place-items-center w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700/50 text-xl shrink-0">
          🔥
        </div>
        <div>
          <p className="text-sm font-black text-white">{profile.sign_in_count} sesiones</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {profile.days_member > 0 ? `Activo desde hace ${profile.days_member} días` : "Nuevo miembro"}
          </p>
        </div>
      </section>

      {/* CTA */}
      <div className="px-4">
        <Link href="/bets"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm font-bold text-white tap hover:bg-zinc-700 transition-colors">
          Registra tus propias apuestas →
        </Link>
      </div>
    </div>
  )
}
