export type ConfidenceTier = "SAFE" | "HIGH" | "MEDIUM"
export type Market = "1X2" | "Over/Under 2.5" | "BTTS" | "Corners" | "Cards"
export type PickResult = "WIN" | "LOSS" | "VOID" | "PENDING"
export type Plan = "basic" | "premium" | "pro"

export interface Pick {
  id: string
  market: Market
  selection: string
  model_prob: number
  confidence_pct: number
  confidence_tier: ConfidenceTier
  reasons: string[]
  best_odd: number | null
  bookmaker: string | null
  value_edge: number | null
  quality_score?: number
  value_reason?: string
  risk_tier?: "low" | "mid" | "high"
  result: PickResult
  plan_required: Plan
  kickoff_utc: string
  home_team: string
  away_team: string
  league_name: string
  country?: string
}

export interface Accumulator {
  id: string
  combined_prob: number
  combined_odd: number
  legs: number
  confidence_tier: ConfidenceTier
  result: PickResult
  plan_required: Plan
  pick_ids: string[]
}

export interface RoiSummary {
  period_days: number
  summary: {
    wins: number
    losses: number
    settled: number
    win_rate_pct: number
    profit_units: number
  }
  daily_history: Array<{
    date: string
    win_rate: number
    roi_pct: number
    picks_total: number
    picks_won: number
  }>
}

export interface SystemStats {
  total_picks: number
  wins: number
  losses: number
  win_rate: number
  safe_picks: number
  high_picks: number
  medium_picks: number
}

export interface User {
  id: string
  email: string
  full_name: string
  plan: Plan | "none"
}

export interface PickFilters {
  confidence_min: number
  confidence_max: number
  market?: string
  tier?: ConfidenceTier
  league_id?: number
}
