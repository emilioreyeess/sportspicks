/**
 * World Cup 2026 Module — API pública.
 *
 * Uso típico desde un endpoint:
 *   import { getAllTeams, getMatchCenter } from "@/lib/world-cup"
 *   const data = await getAllTeams()
 */

export * from "./types"

export {
  WC_TEAMS,
  WC_TEAMS_BY_CODE,
  TOP_REFEREES,
  TOP_REFEREES_BY_ID,
  classifyRefereeSeverity,
  isDrawCompleted,
} from "./static-data"

export {
  cacheGet,
  cacheSet,
  cached,
  cacheInvalidate,
  WC_CACHE_TTL,
} from "./cache"

export {
  // Teams
  getAllTeams,
  getTeamByCode,
  // Squad
  getTeamSquad,
  // Form
  getTeamForm,
  computeXgFromForm,
  // Fixtures
  getAllFixtures,
  getFixtureById,
  // Standings / Bracket
  getGroupStandings,
  getBracket,
  // Match center
  getMatchCenter,
  // Referees
  getRefereeById,
  getAllReferees,
  refreshRefereeSeverity,
  // Team detail
  getTeamDetail,
} from "./data-service"

export {
  WORLD_CUP_CONSENSUS_WEIGHTS,
  applyWorldCupWeightOverride,
  detectBothNeedDraw,
  enrichContextFlagsForWorldCup,
  recencyWeightForWorldCup,
  bothNeedDrawShift,
} from "./decision-overrides"
