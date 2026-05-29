import { NextRequest } from "next/server"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 60

// Whitelist de slugs de liga válidos — protección contra SSRF en la URL de ESPN
const VALID_SLUGS = new Set([
  "esp.1", "eng.1", "ger.1", "ita.1", "fra.1", "usa.1", "mex.1", "por.1",
  "ned.1", "arg.1", "bra.1", "tur.1", "sau.1", "sco.1", "col.1", "chi.1",
  "jpn.1", "uefa.champions", "uefa.europa",
  // Selecciones nacionales (deben coincidir con los slugs de stats/search)
  "fifa.world", "UEFA.EURO", "conmebol.america", "fifa.friendly",
])

const LEAGUE_NAMES: Record<string, string> = {
  "esp.1": "LaLiga", "eng.1": "Premier League", "ger.1": "Bundesliga",
  "ita.1": "Serie A", "fra.1": "Ligue 1", "usa.1": "MLS",
  "arg.1": "Liga Argentina", "bra.1": "Brasileirão", "por.1": "Primeira Liga",
  "uefa.champions": "Champions League", "mex.1": "Liga MX", "ned.1": "Eredivisie",
  "tur.1": "Süper Lig", "sau.1": "Saudi Pro League", "sco.1": "Scottish Premiership",
  "col.1": "Liga BetPlay", "uefa.europa": "Europa League", "jpn.1": "J1 League",
  "fifa.world": "Copa del Mundo", "UEFA.EURO": "Eurocopa",
  "conmebol.america": "Copa América", "fifa.friendly": "Selección",
}

function parseScore(s: any): number {
  if (s == null) return 0
  if (typeof s === "number") return s
  if (typeof s === "string") return parseInt(s) || 0
  if (typeof s === "object" && s.displayValue) return parseInt(s.displayValue) || 0
  return 0
}

function currentSeason(): string {
  const d = new Date()
  const startYear = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1
  return `${startYear}/${String(startYear + 1).slice(2)}`
}

/** Extrae un stat por etiqueta del boxscore.teams[i].statistics */
function getStat(team: any, ...labels: string[]): number | null {
  const stats: any[] = team?.statistics ?? []
  for (const lab of labels) {
    const s = stats.find((x) => (x.label ?? x.name ?? "").toLowerCase() === lab.toLowerCase())
    if (!s) continue
    const v = s.displayValue ?? s.value
    if (v == null) continue
    const n = parseFloat(String(v).replace("%", "").replace(",", ""))
    if (isFinite(n)) return n
  }
  return null
}

export async function GET(req: NextRequest) {
  // Rate limit: previene abuso de la API externa de ESPN
  const ip = getClientIp(req)
  if (!consume(`stats-team:${ip}`, 20, 4)) return tooManyRequests(60)

  const idRaw = req.nextUrl.searchParams.get("id") ?? ""
  const slug = req.nextUrl.searchParams.get("slug") ?? "esp.1"

  // Validación estricta: id solo dígitos (3-7), slug en whitelist (evita SSRF)
  if (!/^\d{1,7}$/.test(idRaw)) {
    return Response.json({ error: "ID inválido" }, { status: 400 })
  }
  if (!VALID_SLUGS.has(slug)) {
    return Response.json({ error: "Liga no soportada" }, { status: 400 })
  }
  const id = idRaw

  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(slug)}/teams/${encodeURIComponent(id)}/schedule`,
      { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return Response.json({ error: "Team not found" }, { status: 404 })
    const data = await res.json()

    const teamName = data?.team?.displayName ?? "Equipo"
    const events: any[] = data?.events ?? []
    const completed = events.filter((ev) => ev.competitions?.[0]?.status?.type?.completed)

    let wins = 0, draws = 0, losses = 0
    let goalsFor = 0, goalsAgainst = 0
    let homeWins = 0, homeDraws = 0, homeLosses = 0, homeGF = 0, homeGA = 0
    let awayWins = 0, awayDraws = 0, awayLosses = 0, awayGF = 0, awayGA = 0
    let cleanSheets = 0, bttsCount = 0, over25Count = 0
    const formList: string[] = []

    for (const ev of completed) {
      const comp = ev.competitions[0]
      const me = comp.competitors?.find((c: any) => String(c.team?.id) === String(id))
      const opp = comp.competitors?.find((c: any) => String(c.team?.id) !== String(id))
      if (!me || !opp) continue

      const myScore = parseScore(me.score)
      const oppScore = parseScore(opp.score)
      const isHome = me.homeAway === "home"

      goalsFor += myScore; goalsAgainst += oppScore
      if (oppScore === 0) cleanSheets++
      if (myScore > 0 && oppScore > 0) bttsCount++
      if (myScore + oppScore > 2) over25Count++

      let result: string
      if (me.winner) { wins++; result = "W" }
      else if (opp.winner) { losses++; result = "L" }
      else { draws++; result = "D" }
      formList.push(result)

      if (isHome) {
        if (result === "W") homeWins++; else if (result === "D") homeDraws++; else homeLosses++
        homeGF += myScore; homeGA += oppScore
      } else {
        if (result === "W") awayWins++; else if (result === "D") awayDraws++; else awayLosses++
        awayGF += myScore; awayGA += oppScore
      }
    }

    const played = wins + draws + losses
    const btts_pct = played ? Math.round((bttsCount / played) * 100) : 0
    const over25_pct = played ? Math.round((over25Count / played) * 100) : 0

    // ── Stats AVANZADAS desde el boxscore de ESPN (últimos 6 partidos) ──────
    // Reales. Si la API falla, devolvemos null y NO inventamos nada.
    const recent = [...completed]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6)

    const summaries = await Promise.all(recent.map(async (ev) => {
      try {
        const r = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${ev.id}`,
          { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(7000) }
        )
        if (!r.ok) return null
        return await r.json()
      } catch { return null }
    }))

    let cF = 0, cA = 0, yel = 0, red = 0, fou = 0, sh = 0, sot = 0, poss = 0, samples = 0
    for (const summary of summaries) {
      if (!summary) continue
      const teams: any[] = summary?.boxscore?.teams ?? []
      const me = teams.find((t) => String(t.team?.id) === String(id))
      const opp = teams.find((t) => String(t.team?.id) !== String(id))
      if (!me) continue

      const ck = getStat(me, "Corner Kicks")
      const ckA = getStat(opp, "Corner Kicks")
      const yc = getStat(me, "Yellow Cards")
      const rc = getStat(me, "Red Cards")
      const fl = getStat(me, "Fouls")
      const shots = getStat(me, "SHOTS", "Shots")
      const onT = getStat(me, "ON GOAL", "Shots on Target")
      const pos = getStat(me, "Possession")

      let had = false
      if (ck != null) { cF += ck; had = true }
      if (ckA != null) cA += ckA
      if (yc != null) yel += yc
      if (rc != null) red += rc
      if (fl != null) fou += fl
      if (shots != null) sh += shots
      if (onT != null) sot += onT
      if (pos != null) poss += pos
      if (had) samples++
    }

    const adv = samples > 0 ? {
      avg_corners_for:       Math.round(cF / samples * 10) / 10,
      avg_corners_against:   Math.round(cA / samples * 10) / 10,
      avg_cards:             Math.round((yel + red) / samples * 10) / 10,
      avg_yellows:           Math.round(yel / samples * 10) / 10,
      avg_reds:              Math.round(red / samples * 10) / 10,
      avg_fouls:             Math.round(fou / samples * 10) / 10,
      avg_shots:             Math.round(sh / samples * 10) / 10,
      avg_shots_on_target:   Math.round(sot / samples * 10) / 10,
      avg_possession:        Math.round(poss / samples),
      advanced_samples:      samples,
    } : null

    return Response.json({
      id: parseInt(id), slug,
      name: teamName,
      league: LEAGUE_NAMES[slug] ?? slug,
      season: currentSeason(),
      played, wins, draws, losses,
      goals_for: goalsFor, goals_against: goalsAgainst,
      xg_for: null, xg_against: null,           // xG no disponible en ESPN — nunca inventado
      btts_pct, over25_pct, clean_sheets: cleanSheets,
      avg_corners_for:     adv?.avg_corners_for     ?? null,
      avg_corners_against: adv?.avg_corners_against ?? null,
      avg_cards:           adv?.avg_cards           ?? null,
      avg_yellows:         adv?.avg_yellows         ?? null,
      avg_reds:            adv?.avg_reds            ?? null,
      avg_fouls:           adv?.avg_fouls           ?? null,
      avg_shots:           adv?.avg_shots           ?? null,
      avg_shots_on_target: adv?.avg_shots_on_target ?? null,
      avg_possession:      adv?.avg_possession      ?? null,
      advanced_samples:    adv?.advanced_samples    ?? 0,
      form: formList.slice(-10),
      home: {
        played: homeWins + homeDraws + homeLosses,
        wins: homeWins, draws: homeDraws, losses: homeLosses,
        goals_for: homeGF, goals_against: homeGA,
      },
      away: {
        played: awayWins + awayDraws + awayLosses,
        wins: awayWins, draws: awayDraws, losses: awayLosses,
        goals_for: awayGF, goals_against: awayGA,
      },
    })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
