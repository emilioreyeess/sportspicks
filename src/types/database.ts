// ── Enums ─────────────────────────────────────────────────────
export type BetStatus    = "pending" | "won" | "lost" | "void" | "cashout"
export type LegStatus    = "pending" | "won" | "lost" | "void"
export type GroupRole    = "admin" | "member"
export type BountyStatus = "pending" | "approved" | "rejected"

// ── Users ─────────────────────────────────────────────────────
export interface UserLog {
  id:             number
  email:          string
  name:           string | null
  avatar_url:     string | null
  provider:       string
  plan:           string
  is_vip_tipster: boolean
  first_sign_in:  string
  last_sign_in:   string
  sign_in_count:  number
}

// ── Bets ──────────────────────────────────────────────────────
export interface Bet {
  id:               string
  user_email:       string
  title:            string | null
  stake:            number | null
  odds:             number | null
  potential_return: number | null
  profit:           number | null
  status:           BetStatus
  is_pre_match:     boolean
  is_published:     boolean
  is_pro_exclusive: boolean
  ai_analyzed:      boolean
  created_at:       string
  settled_at:       string | null
  legs?:            BetLeg[]
}

export interface BetLeg {
  id:         string
  bet_id:     string
  match_name: string
  market:     string
  selection:  string
  odds:       number
  status:     LegStatus
  created_at: string
}

// Computed stats (calculated server-side, never stored)
export interface UserBetStats {
  total:        number
  won:          number
  lost:         number
  pending:      number
  win_rate:     number   // won / settled * 100
  total_stake:  number
  total_profit: number
  yield_pct:    number   // total_profit / total_stake * 100
}

// ── Friend Groups ─────────────────────────────────────────────
export interface FriendGroup {
  id:           string
  name:         string
  description:  string | null
  avatar_emoji: string
  created_by:   string
  invite_code:  string
  is_private:   boolean
  created_at:   string
  member_count?: number
  members?:     GroupMember[]
}

export interface GroupMember {
  id:         string
  group_id:   string
  user_email: string
  role:       GroupRole
  joined_at:  string
}

export interface GroupMessage {
  id:           string
  group_id:     string
  user_email:   string
  message_text: string | null
  bet_id:       string | null
  created_at:   string
  bet?:         Bet
}

// ── VIP & Tipster ─────────────────────────────────────────────
export interface VipAccessCode {
  id:         string
  code:       string
  granted_to: string | null
  used_at:    string | null
  expires_at: string | null
  is_active:  boolean
  created_at: string
}

export interface TipsterBounty {
  id:            string
  tipster_email: string
  bet_id:        string
  twitter_url:   string | null
  status:        BountyStatus
  payout_amount: number | null
  submitted_at:  string
  resolved_at:   string | null
  bet?:          Bet
}

// ── AI Embeddings (RAG) ───────────────────────────────────────
export interface AiLearningEmbedding {
  id:         string
  content:    string
  embedding:  number[] | null
  metadata:   Record<string, unknown>
  created_at: string
}
