import { NextRequest } from "next/server"
import { runPipeline } from "@/lib/pipeline"

export const runtime = "nodejs"
export const maxDuration = 300

export async function GET(req: NextRequest) {
  // Vercel cron requests include a secret header; validate it in production
  const authHeader = req.headers.get("authorization")
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await runPipeline()
    return Response.json({ ok: true, ran: new Date().toISOString() })
  } catch (err: any) {
    console.error("[refresh-picks] pipeline error:", err?.message)
    return Response.json({ ok: false, error: err?.message ?? "Unknown error" }, { status: 500 })
  }
}
