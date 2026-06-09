/**
 * POST /api/groups/upload
 * Accepts a multipart form with field "file" (image).
 * Uploads to Supabase Storage bucket "group-images" via service role.
 * Returns { url: "https://..." }
 */

import { NextRequest } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { createServiceClient } from "@/lib/supabase/client"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_SIZE = 5 * 1024 * 1024  // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

export async function POST(req: NextRequest) {
  // Auth
  const session = await getServerSession()
  if (!session?.user?.email) {
    return Response.json({ error: "No autorizado" }, { status: 401 })
  }

  // Rate limit: 10 uploads per user per hour
  const ip = getClientIp(req)
  if (!consume(`img-upload:${ip}`, 10, 1 / 6)) return tooManyRequests(60)

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  if (!file) {
    return Response.json({ error: "No se proporcionó archivo" }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json({ error: "Tipo de archivo no soportado (usa JPG, PNG, GIF o WebP)" }, { status: 415 })
  }

  if (file.size > MAX_SIZE) {
    return Response.json({ error: "La imagen no puede superar 5 MB" }, { status: 413 })
  }

  const sb = createServiceClient()

  // Generate a unique path: {email_hash}/{timestamp}.{ext}
  const ext = file.type.split("/")[1] ?? "jpg"
  const emailHash = Buffer.from(session.user.email).toString("base64url").slice(0, 12)
  const path = `${emailHash}/${Date.now()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await sb.storage
    .from("group-images")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error("[upload] Supabase storage error:", uploadError.message)
    return Response.json({ error: "Error al subir la imagen" }, { status: 500 })
  }

  const { data: publicData } = sb.storage.from("group-images").getPublicUrl(path)

  return Response.json({ url: publicData.publicUrl }, { status: 201 })
}
