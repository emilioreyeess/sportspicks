/**
 * GET /api/cron/settle-bets
 * Cron nocturno: liquida apuestas pendientes contra resultados reales de ESPN.
 *
 * Lógica:
 * 1. Busca todas las apuestas con status="pending" de hace ≥ 1 día.
 * 2. Para cada apuesta, intenta resolver sus piernas en ESPN.
 * 3. Parlay: todas las piernas WIN → apuesta WIN; cualquier LOSS → apuesta LOST.
 * 4. Actualiza bet.status + bet.settled_at en Supabase.
 *
 * Vercel Hobby: se puede añadir como cron diario a las 02:00 UTC en vercel.json.
 */
import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// ─── Liga slugs para ESPN ────────────────────────────────────────────────────
const ALL_SLUGS = [
  "esp.1", "eng.1", "ger.1", "ita.1", "fra.1",
  "usa.1", "mex.1", "por.1", "ned.1", "arg.1",
  "bra.1", "tur.1", "sau.1", "fra.2", "col.1",
  "chi.1", "jpn.1", "bel.1", "uru.1", "eng.2",
  "esp.2", "ger.2", "uefa.champions", "uefa.europa",
]

// ─── Normalización de nombres ────────────────────────────────────────────────
function normTeam(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim()
}

/** Fuzzy match: verdadero si los nombres se solapan lo suficiente */
function teamsMatch(a: string, b: string): boolean {
  const na = normTeam(a)
  const nb = normTeam(b)
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true
  // match por primeras 4+ caracteres en palabras largas
  const wa = na.split(" ")
  const wb = nb.split(" ")
  return wa.some(w => w.length >= 4 && wb.some(x => x.length >= 4 && (w.startsWith(x.slice(0, 5)) || x.startsWith(w.slice(0, 5)))))
}

// ─── Evaluación de resultado ─────────────────────────────────────────────────
function evaluateLeg(
  selection: string,
  market: string,
  homeName: string,
  awayName: string,
  homeScore: number,
  awayScore: number,
): "won" | "lost" | "void" {
  const total = homeScore + awayScore
  const sel = selection.toLowerCase()
  const mkt = (market || selection).toLowerCase()

  // 1X2 / ganador
  if (mkt.includes("1x2") || mkt.includes("ganador") || sel.includes("gana ") || sel.startsWith("1") || sel === "x" || sel === "2") {
    const selNorm = normTeam(sel.replace("gana ", ""))
    if (sel === "1" || sel === "empate" || sel === "x" || sel === "2") {
      if (sel === "x" || sel === "empate") return homeScore === awayScore ? "won" : "lost"
      if (sel === "1") return homeScore > awayScore ? "won" : "lost"
      if (sel === "2") return awayScore > homeScore ? "won" : "lost"
    }
    if (teamsMatch(selNorm, homeName)) return homeScore > awayScore ? "won" : "lost"
    if (teamsMatch(selNorm, awayName)) return awayScore > homeScore ? "won" : "lost"
    if (sel.includes("empate")) return homeScore === awayScore ? "won" : "lost"
    return "void"
  }

  // Over/Under
  if (mkt.includes("over") || mkt.includes("under") || mkt.includes("goles")) {
    const num = parseFloat((sel.match(/[\d.]+/) ?? ["2.5"])[0]) || 2.5
    if (sel.includes("over") || sel.includes("más de") || sel.includes("mas de")) {
      return total > num ? "won" : "lost"
    }
    if (sel.includes("under") || sel.includes("menos de")) {
      return total < num ? "won" : "lost"
    }
    return "void"
  }

  // BTTS
  if (mkt.includes("btts") || sel.includes("ambos") || sel.includes("marcan") || sel.includes("anotan")) {
    const btts = homeScore > 0 && awayScore > 0
    if (sel.includes("sí") || sel.includes("si") || sel.includes("yes")) return btts ? "won" : "lost"
    if (sel.includes("no"))  return !btts ? "won" : "lost"
    return "void"
  }

  // Doble oportunidad
  if (mkt.includes("doble") || mkt.includes("1x") || mkt.includes("x2") || mkt.includes("12")) {
    const selNorm = normTeam(sel)
    const homeWins = homeScore > awayScore
    const awayWins = awayScore > homeScore
    const draw = homeScore === awayScore
    if (sel === "1x")  return homeWins || draw ? "won" : "lost"
    if (sel === "x2")  return awayWins || draw ? "won" : "lost"
    if (sel === "12")  return homeWins || awayWins ? "won" : "lost"
    if (selNorm.includes(normTeam(homeName)) && selNorm.includes("empate")) return homeWins || draw ? "won" : "lost"
    if (selNorm.includes(normTeam(awayName)) && selNorm.includes("empate")) return awayWins || draw ? "won" : "lost"
    return "void"
  }

  // Hándicap
  if (mkt.includes("handicap") || mkt.includes("hándicap") || sel.includes("+") || sel.includes("-")) {
    const m = sel.match(/([+-]?\d+\.?\d*)$/)
    if (!m) return "void"
    const line = parseFloat(m[1])
    const isHome = teamsMatch(normTeam(sel.replace(m[1], "")), homeName)
    const myScore = isHome ? homeScore + line : awayScore + line
    const oppScore = isHome ? awayScore : homeScore
    if (myScore > oppScore) return "won"
    if (myScore < oppScore) return "lost"
    return "void" // push
  }

  return "void"
}

// ─── Cacheo de resultados ESPN por fecha ─────────────────────────────────────
const espnCache = new Map<string, Map<string, { homeScore: number; awayScore: number; home: string; away: string }>>()

async function fetchESPNResults(dateStr: string): Promise<Map<string, { homeScore: number; awayScore: number; home: string; away: string }>> {
  if (espnCache.has(dateStr)) return espnCache.get(dateStr)!

  const resultMap = new Map<string, { homeScore: number; awayScore: number; home: string; away: string }>()
  const yyyymmdd = dateStr.replace(/-/g, "")

  await Promise.all(
    ALL_SLUGS.map(async (slug) => {
      try {
        const res = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${yyyymmdd}&limit=50`,
          { signal: AbortSignal.timeout(8000) },
        )
        if (!res.ok) return
        const data = await res.json()
        for (const ev of data?.events ?? []) {
          const comp = ev.competitions?.[0]
          if (!comp?.status?.type?.completed) continue
          const home = comp.competitors?.find((c: any) => c.homeAway === "home")
          const away = comp.competitors?.find((c: any) => c.homeAway === "away")
          if (!home || !away) continue
          const homeName = home.team?.displayName ?? ""
          const awayName = away.team?.displayName ?? ""
          const key = `${normTeam(homeName)}|||${normTeam(awayName)}`
          resultMap.set(key, {
            homeScore: parseInt(home.score ?? "0", 10),
            awayScore: parseInt(away.score ?? "0", 10),
            home: homeName,
            away: awayName,
          })
        }
      } catch { /* ignorar ligas con error de red */ }
    }),
  )

  espnCache.set(dateStr, resultMap)
  return resultMap
}

/** Busca el partido más parecido en el mapa de resultados ESPN */
function findMatch(
  matchStr: string,
  resultMap: Map<string, { homeScore: number; awayScore: number; home: string; away: string }>,
): { homeScore: number; awayScore: number; home: string; away: string } | null {
  // Intentar parsear "TeamA vs TeamB" o "TeamA - TeamB"
  const sep = matchStr.match(/ vs\.? | - | \/ /i)
  if (!sep) return null
  const parts = matchStr.split(sep[0])
  if (parts.length < 2) return null
  const team1 = parts[0].trim()
  const team2 = parts[parts.length - 1].trim()

  for (const [key, val] of resultMap.entries()) {
    const [rHome, rAway] = key.split("|||")
    if (teamsMatch(rHome, team1) && teamsMatch(rAway, team2)) return val
    if (teamsMatch(rHome, team2) && teamsMatch(rAway, team1)) {
      // Reversed order — swap so we always return home/away in ESPN order
      return { homeScore: val.awayScore, awayScore: val.homeScore, home: val.away, away: val.home }
    }
  }
  return null
}

// ─── Handler principal ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // Verificación de seguridad: requiere CRON_SECRET en producción
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || cronSecret.trim().length < 16) {
    console.error("[settle-bets] CRON_SECRET no configurado — rechazando")
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sb = createServiceClient()
  const log: string[] = []
  let settled = 0, skipped = 0, errors = 0

  try {
    // Buscar apuestas pendientes de hace ≥1 día (settled hoy no → solo ayer y anteriores)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const cutoff = today.toISOString()

    const { data: pendingBets, error: fetchErr } = await sb
      .from("bets")
      .select("id, user_email, title, stake, combined_odds, sport, created_at, bet_legs(id, match, market, selection, odds, status)")
      .eq("status", "pending")
      .lt("created_at", cutoff)
      .limit(200)

    if (fetchErr) {
      log.push(`Error fetching bets: ${fetchErr.message}`)
      return Response.json({ ok: false, log, error: fetchErr.message }, { status: 500 })
    }

    log.push(`Found ${pendingBets?.length ?? 0} pending bets before ${cutoff}`)

    // Agrupar fechas únicas para minimizar llamadas a ESPN
    const datesToFetch = new Set<string>()
    for (const bet of pendingBets ?? []) {
      const betDate = bet.created_at?.split("T")[0]
      if (betDate) {
        // Intentar ese día y el anterior (por si el partido fue el día antes de registrar)
        datesToFetch.add(betDate)
        const d = new Date(betDate)
        d.setDate(d.getDate() - 1)
        datesToFetch.add(d.toISOString().split("T")[0])
        // Y el día siguiente (partido nocturno registrado temprano)
        const d2 = new Date(betDate)
        d2.setDate(d2.getDate() + 1)
        const d2str = d2.toISOString().split("T")[0]
        if (d2str < today.toISOString().split("T")[0]) datesToFetch.add(d2str)
      }
    }

    // Pre-fetch ESPN results para todas las fechas
    log.push(`Pre-fetching ESPN results for dates: ${[...datesToFetch].join(", ")}`)
    const espnByDate: Record<string, Map<string, any>> = {}
    await Promise.all(
      [...datesToFetch].map(async (d) => {
        espnByDate[d] = await fetchESPNResults(d)
        log.push(`  ESPN ${d}: ${espnByDate[d].size} completed matches`)
      })
    )

    // Procesar cada apuesta
    for (const bet of pendingBets ?? []) {
      try {
        const legs: any[] = (bet as any).bet_legs ?? []
        if (!legs.length) {
          // Apuesta sin piernas: no podemos resolver automáticamente
          skipped++
          continue
        }

        const betDate = bet.created_at?.split("T")[0] ?? ""
        const dates = [
          betDate,
          (() => { const d = new Date(betDate); d.setDate(d.getDate() - 1); return d.toISOString().split("T")[0] })(),
          (() => { const d = new Date(betDate); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0] })(),
        ]

        const legResults: Array<"won" | "lost" | "void"> = []
        const legUpdates: Array<{ id: string; status: "won" | "lost" | "void" }> = []

        for (const leg of legs) {
          if (!leg.match) { legResults.push("void"); continue }

          let legResult: "won" | "lost" | "void" = "void"
          let found = false

          for (const d of dates) {
            const resultMap = espnByDate[d]
            if (!resultMap) continue
            const match = findMatch(leg.match, resultMap)
            if (!match) continue

            const sep = leg.match.match(/ vs\.? | - | \/ /i)
            const parts = leg.match.split(sep?.[0] ?? " vs ")
            const homeName = match.home
            const awayName = match.away

            legResult = evaluateLeg(
              leg.selection,
              leg.market || leg.selection,
              homeName,
              awayName,
              match.homeScore,
              match.awayScore,
            )
            found = true
            break
          }

          if (!found) {
            log.push(`  [${bet.id}] No ESPN match found for leg: "${leg.match}"`)
          }

          legResults.push(legResult)
          if (leg.id) legUpdates.push({ id: leg.id, status: legResult })
        }

        // Determinar resultado global del parlay
        // Parlay: si alguna pierna es "lost" → apuesta perdida
        //         si todas son "won" → apuesta ganada
        //         si quedan voided sin resolver → no tocar todavía
        const hasLost = legResults.some(r => r === "lost")
        const allWon = legResults.every(r => r === "won")
        const hasUnresolved = legResults.some(r => r === "void") && !hasLost

        // Si todas son void (ninguna encontrada en ESPN), no liquidar todavía
        const noneFound = legResults.every(r => r === "void")
        if (noneFound) {
          // Solo liquida si ya pasaron 3 días (partido probablemente no disponible en ESPN)
          const daysOld = Math.floor((Date.now() - new Date(bet.created_at).getTime()) / 86400000)
          if (daysOld < 3) { skipped++; continue }
          // Después de 3 días, marcar como void
        }

        const newStatus = hasLost ? "lost" : allWon ? "won" : "void"
        const now = new Date().toISOString()

        // Actualizar piernas en DB
        for (const lu of legUpdates) {
          await sb.from("bet_legs").update({ status: lu.status }).eq("id", lu.id)
        }

        // Actualizar apuesta principal
        const { error: updateErr } = await sb
          .from("bets")
          .update({ status: newStatus, settled_at: now })
          .eq("id", bet.id)

        if (updateErr) {
          log.push(`  [${bet.id}] Update error: ${updateErr.message}`)
          errors++
        } else {
          const profit = newStatus === "won"
            ? ((bet.combined_odds ?? 1) - 1) * (bet.stake ?? 0)
            : -(bet.stake ?? 0)
          log.push(`  [${bet.id}] "${bet.title}" → ${newStatus.toUpperCase()} | ${legs.length} piernas | ${newStatus === "won" ? `+${profit.toFixed(2)}€` : `${profit.toFixed(2)}€`}`)
          settled++
        }
      } catch (e: any) {
        log.push(`  [${bet.id}] Exception: ${e?.message}`)
        errors++
      }
    }

    log.push(`Done: ${settled} settled, ${skipped} skipped, ${errors} errors`)
    return Response.json({
      ok: true,
      settled,
      skipped,
      errors,
      log,
      ts: new Date().toISOString(),
    })
  } catch (e: any) {
    log.push(`Fatal: ${e?.message}`)
    return Response.json({ ok: false, log, error: e?.message }, { status: 500 })
  }
}
