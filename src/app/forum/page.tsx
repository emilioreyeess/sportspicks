"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { Icon } from "@/components/ui/icons"
import { usePlan } from "@/lib/plan"

interface ForumMessage {
  id: string
  content: string | null
  image_url: string | null
  user_email: string
  sender_name: string
  sender_avatar: string | null
  plan: string
  is_verified_tipster: boolean
  created_at: string
}

function PlanBadge({ plan }: { plan: string }) {
  if (plan === "pro") return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-violet-500/20 text-violet-300 border border-violet-700/40 leading-none">PRO</span>
  )
  if (plan === "premium") return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-700/40 leading-none">PREMIUM</span>
  )
  return null
}

function TipsterBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-700/40 leading-none">
      ✓ Tipster
    </span>
  )
}

function ForumPost({ msg, isMe }: { msg: ForumMessage; isMe: boolean }) {
  const initial = msg.sender_name?.[0]?.toUpperCase() ?? "?"
  const time = new Date(msg.created_at).toLocaleString("es-ES", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })
  return (
    <div className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/[0.07] grid place-items-center text-xs font-bold shrink-0 overflow-hidden mt-0.5">
        {msg.sender_avatar
          ? <img src={msg.sender_avatar} className="w-full h-full object-cover" alt="" />
          : initial}
      </div>

      <div className={`max-w-[80%] flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
        {/* Name + badges */}
        <div className={`flex items-center gap-1.5 flex-wrap ${isMe ? "flex-row-reverse" : ""}`}>
          <span className="text-[11px] font-bold text-zinc-300">{msg.sender_name}</span>
          {msg.is_verified_tipster && <TipsterBadge />}
          <PlanBadge plan={msg.plan} />
          <span className="text-[10px] text-zinc-700">{time}</span>
        </div>

        {/* Image */}
        {msg.image_url && (
          <img
            src={msg.image_url}
            alt="imagen"
            className="max-w-[220px] rounded-xl border border-white/[0.07] cursor-pointer"
            onClick={() => window.open(msg.image_url!, "_blank")}
          />
        )}

        {/* Text */}
        {msg.content && (
          <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-snug ${isMe
            ? "bg-emerald-600 text-white rounded-tr-sm"
            : "bg-zinc-800 text-zinc-100 rounded-tl-sm"}`}>
            {msg.content}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ForumPage() {
  const { data: session } = useSession()
  const { plan } = usePlan()
  const [messages, setMessages] = useState<ForumMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const [pendingImg, setPendingImg] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/forum")
    if (res.ok) {
      const d = await res.json()
      setMessages(d.messages ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) return
    if (file.size > 5 * 1024 * 1024) { alert("La imagen no puede superar 5 MB"); return }
    setUploadingImg(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/forum/upload", { method: "POST", body: fd })
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? "Error al subir"); return }
      const { url } = await res.json()
      setPendingImg(url)
    } catch { alert("Error de conexión al subir la imagen") }
    finally { setUploadingImg(false); e.target.value = "" }
  }

  async function handleSend() {
    if ((!input.trim() && !pendingImg) || sending) return
    setSending(true)
    const res = await fetch("/api/forum", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: input.trim() || null, image_url: pendingImg }),
    })
    setSending(false)
    if (res.ok) {
      const d = await res.json()
      setMessages(prev => [...prev, d.message])
      setInput("")
      setPendingImg(null)
    }
  }

  const myEmail = session?.user?.email

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] bg-zinc-950">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-white/[0.07] bg-zinc-950/90 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Icon name="groups" className="w-5 h-5 text-emerald-400" strokeWidth={2} />
          <div>
            <h1 className="text-sm font-black text-white">Foro Público</h1>
            <p className="text-[10px] text-zinc-600">Comparte picks, análisis y combinadas con todos</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16">
            <Icon name="groups" className="w-10 h-10 text-zinc-700 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm font-black text-zinc-400">Sé el primero en publicar</p>
            <p className="text-xs text-zinc-600 mt-1">Comparte tu pick del día o pide análisis</p>
          </div>
        ) : (
          messages.map(msg => (
            <ForumPost key={msg.id} msg={msg} isMe={msg.user_email === myEmail} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Pending image preview */}
      {pendingImg && (
        <div className="shrink-0 px-4 py-2 border-t border-white/[0.07] bg-zinc-950/80 flex items-center gap-2">
          <img src={pendingImg} alt="" className="h-14 w-14 rounded-lg object-cover border border-white/[0.07]" />
          <button onClick={() => setPendingImg(null)} className="text-xs text-red-400 hover:text-red-300">✕ Quitar</button>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 px-4 py-3 border-t border-white/[0.07] bg-zinc-950/90 backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          {/* Image upload */}
          <label className={`shrink-0 tap p-2.5 rounded-xl border border-white/[0.07] hover:border-white/[0.14] text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer ${uploadingImg ? "opacity-40 pointer-events-none" : ""}`}>
            <input type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} disabled={uploadingImg} />
            {uploadingImg
              ? <span className="inline-block w-4 h-4 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
              : <Icon name="image" className="w-4 h-4" strokeWidth={2} />
            }
          </label>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Escribe algo al foro…"
            maxLength={1000}
            className="flex-1 bg-zinc-800/40 border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/[0.16] resize-none"
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !pendingImg) || sending}
            className="shrink-0 tap p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 transition-all"
          >
            {sending
              ? <span className="inline-block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              : <Icon name="arrowRight" className="w-4 h-4" strokeWidth={2.4} />
            }
          </button>
        </div>
        {plan === "free" && (
          <p className="text-[10px] text-zinc-700 text-center mt-1.5">Plan Free · 10 mensajes/10 min</p>
        )}
      </div>
    </div>
  )
}
