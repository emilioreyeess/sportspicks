import type { createServiceClient } from "@/lib/supabase/client"

/**
 * Resolución robusta partido→fixture para apuestas/combinadas.
 *
 * Casa el texto de cada selección ("France vs Senegal", "FRA vs SEN",
 * "Francia vs Senegal") con la tabla oficial `fixtures` para obtener
 * { fixtureId, kickoff }. Maneja:
 *   · nombres en inglés (los que produce el motor)
 *   · códigos de 3 letras (combinada del Mundial: "FRA vs SEN")
 *   · nombres en ESPAÑOL (entrada manual del usuario) vía alias ES→EN
 *
 * Devuelve null SOLO si ninguna selección casa con un fixture real → el caller
 * decide (p.ej. el grupo bloquea el envío). Nunca inventa una hora.
 */

const normName = (s: string) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()

// Alias ES→EN de selecciones del Mundial (y equipos frecuentes) para que una
// entrada manual en español resuelva contra los nombres en inglés de la BD.
const TEAM_ALIASES: Record<string, string> = {
  "francia": "france", "alemania": "germany", "espana": "spain", "inglaterra": "england",
  "paises bajos": "netherlands", "holanda": "netherlands", "belgica": "belgium",
  "arabia saudi": "saudi arabia", "arabia saudita": "saudi arabia", "estados unidos": "usa",
  "corea del sur": "south korea", "corea": "south korea", "sudafrica": "south africa",
  "marruecos": "morocco", "brasil": "brazil", "croacia": "croatia", "suiza": "switzerland",
  "japon": "japan", "catar": "qatar", "argelia": "algeria", "jordania": "jordan",
  "republica checa": "czech republic", "chequia": "czech republic", "noruega": "norway",
  "italia": "italy", "polonia": "poland", "ucrania": "ukraine", "tunez": "tunisia",
  "egipto": "egypt", "iran": "iran", "irak": "iraq", "turquia": "turkiye",
  "nueva zelanda": "new zealand", "curazao": "curacao", "costa de marfil": "ivory coast",
  "escocia": "scotland", "republica de irlanda": "republic of ireland", "irlanda": "republic of ireland",
  "republica democratica del congo": "congo dr", "congo": "congo dr",
  "bosnia y herzegovina": "bosnia & herzegovina", "bosnia": "bosnia & herzegovina",
}

/** Normaliza + traduce ES→EN (frase completa primero, luego por si acaso). */
function canon(s: string): string {
  const n = normName(s)
  return TEAM_ALIASES[n] ?? n
}

/** Separa "Real Madrid vs Barcelona" en [local, visitante]. */
function splitMatch(text: string): [string, string] | null {
  const parts = (text ?? "").replace(/\s+/g, " ").trim().split(/\s+(?:vs?\.?|v|-|–|—|@|contra)\s+/i)
  return parts.length >= 2 && parts[0] && parts[1] ? [parts[0].trim(), parts[1].trim()] : null
}

/** ¿casa el lado de la selección con el nombre del equipo del fixture? */
function sideMatches(legSide: string, fixtureTeam: string): boolean {
  const a = canon(legSide)
  const f = canon(fixtureTeam)
  if (!a || !f) return false
  // Inclusión por substring (cubre códigos "fra"⊂"france" y nombres parciales)
  return a.includes(f) || f.includes(a)
}

export async function resolveBetFixture(
  sb: ReturnType<typeof createServiceClient>,
  legs: Array<{ match?: string | null }>,
): Promise<{ fixtureId: number; kickoff: string } | null> {
  const from = new Date(Date.now() - 2 * 86400000).toISOString()
  const { data } = await sb
    .from("fixtures")
    .select("fixture_id, home_team, away_team, match_date")
    .gte("match_date", from)
    .order("match_date", { ascending: true })
    .limit(1500)
  const fixtures = data ?? []
  if (!fixtures.length) return null

  for (const leg of (legs ?? []).slice(0, 6)) {
    const pair = splitMatch(leg.match ?? "")
    if (!pair) continue
    const hit = fixtures.find((f: any) => {
      const m1 = sideMatches(pair[0], f.home_team ?? "") && sideMatches(pair[1], f.away_team ?? "")
      const m2 = sideMatches(pair[1], f.home_team ?? "") && sideMatches(pair[0], f.away_team ?? "")
      return m1 || m2
    })
    if (hit?.fixture_id && hit.match_date) {
      return { fixtureId: hit.fixture_id, kickoff: hit.match_date }
    }
  }
  return null
}
