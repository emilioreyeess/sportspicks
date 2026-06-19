/**
 * GET /api/world-cup/live — Datos REALES del Mundial desde Supabase.
 *
 * Lee la tabla `fixtures` (league='World Cup', refrescada por el cron
 * /api/cron/sync-football) y devuelve:
 *   · fixtures[]  → calendario real (kickoff UTC, estado, marcador) en forma WCFixture.
 *   · standings[] → clasificación por grupo (PJ, G, E, P, GF, GC, DG, PTS) CALCULADA
 *                   a partir de los partidos finalizados + los grupos de WC_TEAMS.
 *
 * Mapeo de nombres EN→código vía resolveWcCode (robusto); si un equipo no se
 * reconoce, se usa su nombre CRUDO como código de fallback (el render lo muestra
 * tal cual, nunca se rompe ni se vacía).
 */
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/client"
import { WC_TEAMS } from "@/lib/world-cup/static-data"
import { resolveWcCode } from "@/lib/world-cup/name-to-code"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

type Standing = {
  teamCode: string; played: number; won: number; drawn: number; lost: number
  goalsFor: number; goalsAgainst: number; goalDiff: number; points: number
  position: number; qualificationStatus: string
}

// FASE 1: TODOS los estados de finalización de cualquier proveedor (API-Football
// short, nombres largos y nuestro valor de cron). Si está aquí → el partido cuenta
// para la clasificación.
const FINISHED_STATUSES = new Set([
  "finished", "ft", "aet", "pen", "pen.",
  "match finished", "full time", "after extra time", "penalties", "awarded", "wo",
])

function mapStatus(s: string): "scheduled" | "live" | "final" | "postponed" {
  const v = (s ?? "").toLowerCase().trim()
  if (FINISHED_STATUSES.has(v)) return "final"
  if (v === "live" || ["1h", "2h", "ht", "et", "p", "bt", "int"].includes(v)) return "live"
  if (["pst", "canc", "abd", "susp", "postponed", "cancelled", "abandoned"].includes(v)) return "postponed"
  return "scheduled"
}

/** Marcador del partido desde stats.result (cron) o stats.goals (API), o null. */
function scoreOf(stats: any): { home: number; away: number } | null {
  const r = stats?.result
  if (r && r.home != null && r.away != null) return { home: Number(r.home), away: Number(r.away) }
  const g = stats?.goals
  if (g && g.home != null && g.away != null) return { home: Number(g.home), away: Number(g.away) }
  return null
}

export async function GET() {
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from("fixtures")
      .select("fixture_id, home_team, away_team, match_date, status, stats")
      .eq("league", "World Cup")
      .order("match_date", { ascending: true })
      .limit(200)
    if (error) return NextResponse.json({ fixtures: [], standings: [] })
    const rows = data ?? []

    const groupByCode = new Map(WC_TEAMS.map((t) => [t.code, t.group]))

    // ── Fixtures (forma WCFixture) ──
    const fixtures = rows.map((f: any) => {
      const homeCode = resolveWcCode(f.home_team) ?? f.home_team
      const awayCode = resolveWcCode(f.away_team) ?? f.away_team
      const sc = scoreOf(f.stats)
      return {
        matchId: `wc26-${f.fixture_id}`,
        stage: "group" as const,
        group: groupByCode.get(homeCode) ?? null,
        stageMatchNumber: 0,
        kickoffISO: f.match_date,
        venue: { city: "", country: "", stadium: "" },
        homeCode,
        awayCode,
        refereeId: null,
        status: mapStatus(f.status),
        result: sc
          ? { homeScore: sc.home, awayScore: sc.away, homeScoreHT: null, awayScoreHT: null, homePenalties: null, awayPenalties: null }
          : null,
        // FASE 3.2: cuotas reales para las barras de probabilidad de "Mundial Hoy".
        odds: f.stats?.odds
          ? {
              home: f.stats.odds.home ?? null, draw: f.stats.odds.draw ?? null, away: f.stats.odds.away ?? null,
              bttsYes: f.stats.odds.bttsYes ?? null, bttsNo: f.stats.odds.bttsNo ?? null,
            }
          : null,
        homeName: f.home_team,
        awayName: f.away_team,
        source: "api-football" as const,
      }
    })

    // ── Standings: calculados de los partidos finalizados ──
    const tbl = new Map<string, Standing>()
    for (const t of WC_TEAMS) {
      tbl.set(t.code, { teamCode: t.code, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, position: 0, qualificationStatus: "pending" })
    }
    for (const f of rows as any[]) {
      // FASE 1: cuenta si el partido está FINALIZADO (cualquier estado de fin) y
      // tiene marcador (de stats.result o stats.goals). Antes solo miraba result.
      const finished = mapStatus(f.status) === "final"
      const sc = scoreOf(f.stats)
      if (!finished && !sc) continue
      if (!sc) continue                                            // finalizado sin marcador → no se puede atribuir
      const hc = resolveWcCode(f.home_team)
      const ac = resolveWcCode(f.away_team)
      if (!hc || !ac) continue                                     // sin código no se atribuye
      const h = tbl.get(hc); const a = tbl.get(ac)
      if (!h || !a) continue
      const hg = sc.home; const ag = sc.away
      h.played++; a.played++
      h.goalsFor += hg; h.goalsAgainst += ag
      a.goalsFor += ag; a.goalsAgainst += hg
      if (hg > ag) { h.won++; h.points += 3; a.lost++ }
      else if (hg < ag) { a.won++; a.points += 3; h.lost++ }
      else { h.drawn++; a.drawn++; h.points++; a.points++ }
    }
    for (const v of tbl.values()) v.goalDiff = v.goalsFor - v.goalsAgainst

    const byGroup = new Map<string, Standing[]>()
    for (const t of WC_TEAMS) {
      if (!t.group) continue
      if (!byGroup.has(t.group)) byGroup.set(t.group, [])
      byGroup.get(t.group)!.push(tbl.get(t.code)!)
    }
    const standings = [...byGroup.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, teams]) => {
        teams.sort((x, y) => y.points - x.points || y.goalDiff - x.goalDiff || y.goalsFor - x.goalsFor)
        teams.forEach((t, i) => {
          t.position = i + 1
          t.qualificationStatus = t.played === 0 ? "pending" : i < 2 ? "qualified-direct" : "in-contention"
        })
        return { group, teams, fetchedAt: new Date().toISOString(), source: "api-football" as const }
      })

    return NextResponse.json({ fixtures, standings })
  } catch {
    return NextResponse.json({ fixtures: [], standings: [] })
  }
}
