/**
 * GET /api/cron/settle-picks
 * Nightly cron: auto-resolves pending bounties where the linked bet is won,
 * stores a learning embedding for each won bet, and marks approved bounties.
 * Vercel Hobby: fires once daily at 01:00 UTC.
 */
import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  // SECURITY: require non-empty CRON_SECRET — reject if misconfigured or empty
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || cronSecret.trim().length < 16) {
    console.error("[cron] CRON_SECRET not configured or too short — rejecting")
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sb = createServiceClient()
  const log: string[] = []

  // ── 1. Auto-approve bounties whose linked bet is "won" ─────────────────
  const { data: pendingBounties } = await sb
    .from("tipster_bounties")
    .select("id, bet_id, bets(combined_odds, status)")
    .eq("status", "pending")

  let bountiesApproved = 0
  for (const b of pendingBounties ?? []) {
    const bet = (b as any).bets
    if (bet?.status === "won" && (bet?.combined_odds ?? 0) >= 3) {
      await sb.from("tipster_bounties").update({
        status: "approved",
        resolved_at: new Date().toISOString(),
        payout_amount: 5.00,
      }).eq("id", b.id)
      bountiesApproved++
    }
  }
  log.push(`Bounties approved: ${bountiesApproved}`)

  // ── 2. Store learning embeddings for recently won bets ──────────────────
  // Only store if ANTHROPIC_API_KEY is available (skip in dev without key)
  if (process.env.ANTHROPIC_API_KEY) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)

    const { data: wonBets } = await sb
      .from("bets")
      .select("id, title, combined_odds, sport, bet_legs(match, selection, odds)")
      .eq("status", "won")
      .gte("settled_at", yesterday.toISOString())
      .limit(20)

    let embeddingsStored = 0
    for (const bet of wonBets ?? []) {
      const legs = (bet as any).bet_legs ?? []
      const content = [
        `Apuesta ganadora: ${bet.title}`,
        `Cuota: @${bet.combined_odds}`,
        `Deporte: ${bet.sport}`,
        ...legs.map((l: any) => `${l.match} → ${l.selection} @${l.odds}`),
      ].join("\n")

      // Check duplicate
      const { data: dup } = await sb
        .from("ai_learning_embeddings")
        .select("id")
        .eq("metadata->>bet_id", bet.id)
        .single()
      if (dup) continue

      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

        // Use Claude to generate a summary for the embedding content
        const summary = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          messages: [{ role: "user", content: `Resume en 1 frase el patrón de esta apuesta ganadora:\n${content}` }],
        })
        const summaryText = (summary.content[0] as any).text ?? content

        // Store without vector for now (vector requires separate embedding model)
        await sb.from("ai_learning_embeddings").insert({
          content: summaryText,
          metadata: { bet_id: bet.id, sport: bet.sport, odds: bet.combined_odds },
        })
        embeddingsStored++
      } catch (e: any) {
        log.push(`Embedding error for ${bet.id}: ${e?.message}`)
      }
    }
    log.push(`Embeddings stored: ${embeddingsStored}`)
  } else {
    log.push("ANTHROPIC_API_KEY not set — skipped embeddings")
  }

  return Response.json({ ok: true, log, ts: new Date().toISOString() })
}
