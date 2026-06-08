import { NextRequest } from "next/server"
import { getServerSession } from "@/lib/auth-server"
import { createServiceClient } from "@/lib/supabase/client"
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.email) return Response.json({ error: "No autorizado" }, { status: 401 })

  const ip = getClientIp(req)
  if (!consume(`forum-img-upload:${ip}`, 5, 5)) return tooManyRequests(60)

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return Response.json({ error: "Sin archivo" }, { status: 400 })
  if (!file.type.startsWith("image/")) return Response.json({ error: "Solo se permiten imágenes" }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return Response.json({ error: "Imagen demasiado grande (máx. 5 MB)" }, { status: 400 })

  const sb = createServiceClient()
  const ext = file.name.split(".").pop() ?? "jpg"
  const fileName = `forum/${session.user.email.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error } = await sb.storage.from("forum-images").upload(fileName, buffer, {
    contentType: file.type, upsert: false,
  })
  if (error) return Response.json({ error: "Error al subir imagen: " + error.message }, { status: 500 })

  const { data: publicData } = sb.storage.from("forum-images").getPublicUrl(fileName)
  return Response.json({ url: publicData.publicUrl })
}
