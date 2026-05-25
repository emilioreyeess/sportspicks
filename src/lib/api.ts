import type { Pick, PickFilters } from "@/types"

// ---- Picks ----

export async function getPicks(
  _date?: string,
  filters: PickFilters = { confidence_min: 0, confidence_max: 100 },
): Promise<{ picks: Pick[]; total: number; date: string; note?: string }> {
  const params = new URLSearchParams({
    confidence_min: String(filters.confidence_min),
    confidence_max: String(filters.confidence_max),
    ...(filters.market ? { market: filters.market } : {}),
    ...(filters.tier ? { tier: filters.tier } : {}),
  })
  const res = await fetch(`/api/picks?${params}`)
  return res.json()
}

// ---- Acumuladoras ----

export async function getAccumulators() {
  const res = await fetch("/api/combinadas/list")
  return res.json()
}

// ---- Combinadas ----

export async function getCombinada(mode: string, leagueId?: string) {
  const params = new URLSearchParams({ mode })
  if (leagueId) params.set("league_id", leagueId)
  const res = await fetch(`/api/combinadas?${params}`)
  return res.json()
}

// ---- Stats ----

export async function searchTeams(q: string) {
  const res = await fetch(`/api/stats/search?q=${encodeURIComponent(q)}`)
  return res.json()
}

export async function getTeamStats(id: number, name: string) {
  const res = await fetch(`/api/stats/team?id=${id}&name=${encodeURIComponent(name)}`)
  return res.json()
}

// ---- Stats del sistema ----

export async function getSystemStats() {
  const res = await fetch("/api/stats/system")
  return res.json()
}

export async function getRoi(days = 30) {
  const res = await fetch(`/api/stats/roi?days=${days}`)
  return res.json()
}

// ---- Retos ----

export async function getChallenges() {
  const res = await fetch("/api/retos")
  return res.json()
}
