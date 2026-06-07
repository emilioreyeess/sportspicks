"use client"

/**
 * FixturesAccordion — vista de partidos con acordeón, ligas TOP + "Ver más",
 * y pronóstico Poisson lazy (calculado SOLO al abrir el acordeón).
 *
 * Soft-paywall: la info básica (equipos, hora, liga, posición, racha, frecuencia
 * de anotación) es pública e indexable. El PRONÓSTICO derivado (BTTS, Over/Under,
 * 1X2 vía Poisson) es premium — usuarios sin plan ven un bloqueo in-situ.
 *
 * Poisson se deriva ÚNICA Y EXCLUSIVAMENTE de los goles a favor/contra del
 * stats JSONB. No se calculan córners ni tarjetas (no hay histórico).
 */

import { useState } from "react"
import Link from "next/link"
import { usePlan } from "@/lib/plan"
import type { Fixture, FixtureStats, StandingRow } from "@/lib/infrastructure/footballApi"

// ── Ligas TOP (match por substring sobre league.name de API-Football) ──────────
const TOP_LEAGUE_PATTERNS = [
  "premier league", "la liga", "serie a", "bundesliga", "ligue 1",
  "champions league", "europa league", "primeira liga", "eredivisie",
  "major league soccer", "mls", "liga profesional", "saudi pro league",
  "liga mx", "championship", "conference league",
]

function isTopLeague(name: string | null): boolean {
  if (!name) return false
  const n = name.toLowerCase()
  return TOP_LEAGUE_PATTERNS.some((p) => n.includes(p))
}

// ── Poisson (cliente, ligero) ──────────────────────────────────────────────────
function poisson(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0
  let p = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) p *= lambda / i
  return p
}

interface Markets { btts: number; over25: number; pHome: number; pDraw: number; pAway: number }

/** Deriva BTTS / Over2.5 / 1X2 desde la media de goles (GF/GC) de la clasificación. */
function deriveMarkets(home: StandingRow | null, away: StandingRow | null): Markets | null {
  if (!home || !away || home.played < 3 || away.played < 3) return null
  const hGF = home.goalsFor / home.played, hGA = home.goalsAgainst / home.played
  const aGF = away.goalsFor / away.played, aGA = away.goalsAgainst / away.played
  // Goles esperados: ataque propio combinado con defensa rival, leve ventaja local.
  const lh = Math.max(0.15, ((hGF + aGA) / 2) * 1.10)
  const la = Math.max(0.15, ((aGF + hGA) / 2) * 0.92)

  const MAX = 8
  let pH = 0, pD = 0, pA = 0, over = 0, homeScores = 0, awayScores = 0
  for (let i = 0; i <= MAX; i++) {
    for (let j = 0; j <= MAX; j++) {
      const p = poisson(i, lh) * poisson(j, la)
      if (i > j) pH += p; else if (i === j) pD += p; else pA += p
      if (i + j >= 3) over += p
      if (i >= 1) homeScores += p
      if (j >= 1) awayScores += p
    }
  }
  // BTTS ≈ P(home marca) * P(away marca) (independencia Poisson)
  const btts = homeScores * awayScores
  return { btts, over25: over, pHome: pH, pDraw: pD, pAway: pA }
}

const pct = (x: number) => `${Math.round(x * 100)}%`

// ── Helpers de formato ──────────────────────────────────────────────────────────
function fmtTime(iso: string | null): string {
  if (!iso) return "--:--"
  try {
    return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(iso))
  } catch { return "--:--" }
}

function rate(st: StandingRow | null): string {
  if (!st || st.played < 1) return "sin datos"
  const gf = (st.goalsFor / st.played).toFixed(2)
  const gc = (st.goalsAgainst / st.played).toFixed(2)
  return `${gf} a favor · ${gc} en contra /partido`
}

// ── Item de acordeón ────────────────────────────────────────────────────────────
function MatchRow({ f, isPremium }: { f: Fixture; isPremium: boolean }) {
  const [open, setOpen] = useState(false)
  const s = (f.stats ?? null) as FixtureStats | null
  const home = f.home_team ?? "?", away = f.away_team ?? "?"
  const hSt = s?.home?.standing ?? null, aSt = s?.away?.standing ?? null

  // Lazy: el cálculo Poisson solo ocurre cuando el acordeón está abierto.
  const markets = open && isPremium ? deriveMarkets(hSt, aSt) : null

  return (
    <div className="border-b border-zinc-800 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-900/60 transition-colors"
      >
        <span className="font-mono text-[12px] text-zinc-500 tabular-nums w-12 shrink-0">{fmtTime(f.match_date)}</span>
        <span className="flex-1 min-w-0 text-[13px] text-white truncate">
          {home} <span className="text-zinc-600">vs</span> {away}
        </span>
        <span className="text-[10px] font-mono text-zinc-600 shrink-0">{f.status ?? ""}</span>
        <span className="text-zinc-600 text-xs shrink-0">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 bg-zinc-950/40">
          {/* Frecuencia de anotación + posición + racha (público) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
            {[{ n: home, st: hSt }, { n: away, st: aSt }].map(({ n, st }) => (
              <div key={n} className="border border-zinc-800 px-3 py-2">
                <p className="font-bold text-white text-[12.5px] mb-1 truncate">{n}</p>
                <p className="text-zinc-500">
                  {st ? `${st.rank}º · ${st.points} pts${st.form ? ` · racha ${st.form}` : ""}` : "posición no disponible"}
                </p>
                <p className="text-zinc-600 mt-0.5">Frecuencia de anotación: {rate(st)}</p>
              </div>
            ))}
          </div>

          {/* Pronóstico Poisson — PREMIUM */}
          {isPremium ? (
            markets ? (
              <div className="border border-emerald-700/30 bg-emerald-500/[0.04] px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/70 mb-1.5">
                  Pronóstico cuantitativo (Poisson sobre goles)
                </p>
                <div className="grid grid-cols-3 gap-2 text-[12px] font-mono text-zinc-300">
                  <span>1: <b className="text-white">{pct(markets.pHome)}</b></span>
                  <span>X: <b className="text-white">{pct(markets.pDraw)}</b></span>
                  <span>2: <b className="text-white">{pct(markets.pAway)}</b></span>
                  <span>BTTS: <b className="text-emerald-400">{pct(markets.btts)}</b></span>
                  <span className="col-span-2">Over 2.5: <b className="text-emerald-400">{pct(markets.over25)}</b></span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-zinc-600 font-mono">// datos de goles insuficientes para el pronóstico</p>
            )
          ) : (
            <div className="border border-zinc-700 bg-zinc-900/60 px-4 py-4 text-center">
              <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-600 mb-1">// pronóstico bloqueado</p>
              <p className="text-[13px] text-zinc-300 mb-3">BTTS, Over/Under y 1X2 con modelo Poisson</p>
              <Link href="/pricing" className="inline-block border border-emerald-400 bg-emerald-400 px-5 py-2 text-[12px] font-black uppercase tracking-wider text-black hover:bg-emerald-300 transition-colors">
                Suscríbete a Premium
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────────
export function FixturesAccordion({ fixtures }: { fixtures: Fixture[] }) {
  const { isPremium } = usePlan()
  const [showOthers, setShowOthers] = useState(false)

  const top = fixtures.filter((f) => isTopLeague(f.league))
  const others = fixtures.filter((f) => !isTopLeague(f.league))

  // Agrupa por liga, preservando orden de aparición.
  const groupByLeague = (list: Fixture[]) => {
    const m = new Map<string, Fixture[]>()
    for (const f of list) {
      const k = f.league ?? "Otras competiciones"
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(f)
    }
    return [...m.entries()]
  }

  const renderGroups = (groups: [string, Fixture[]][]) =>
    groups.map(([league, list]) => (
      <section key={league} className="border-x border-b border-zinc-800">
        <h2 className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-400">
          {league} <span className="text-zinc-600">· {list.length}</span>
        </h2>
        {list.map((f) => <MatchRow key={f.fixture_id} f={f} isPremium={isPremium} />)}
      </section>
    ))

  return (
    <div>
      {top.length > 0 ? renderGroups(groupByLeague(top)) : (
        <div className="border-x border-b border-zinc-800 px-6 py-10 text-center font-mono text-[12px] text-zinc-600">
          // no hay partidos de ligas top hoy
        </div>
      )}

      {others.length > 0 && (
        <div className="mt-4">
          {!showOthers ? (
            <button
              onClick={() => setShowOthers(true)}
              className="w-full border border-zinc-800 px-4 py-3 text-[12px] font-bold uppercase tracking-wider text-zinc-400 hover:bg-zinc-900/60 transition-colors"
            >
              Ver más ligas (+{others.length} partidos)
            </button>
          ) : (
            renderGroups(groupByLeague(others))
          )}
        </div>
      )}
    </div>
  )
}
