"use client"

import { useState, useEffect, useCallback } from "react"
import { Icon } from "@/components/ui/icons"
import { useSession } from "@/lib/auth-client"
import Link from "next/link"
import type { ExtractedBet } from "@/lib/bets/types"
import { extractBetDataReal } from "@/lib/actions/ocr-action"
import { BetConfirmationModal, type ConfirmedBet } from "@/components/bets/BetConfirmationModal"
import { ZoomableImage } from "@/components/ui/ZoomableImage"

// ── Types ─────────────────────────────────────────────────────
interface Group {
  id: string
  name: string
  emoji: string
  avatar_emoji: string
  member_count: number
  last_message: string | null
  last_message_at: string | null
  unread: number
  my_role: "admin" | "member"
  role: "admin" | "member"
  invite_code?: string
}

type ChatTab = "chat" | "members" | "ranking" | "bets"

// ── Empty states ──────────────────────────────────────────────
function EmptyChat() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center px-6 py-12">
      <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/[0.07] grid place-items-center mb-3">
        <Icon name="groups" className="w-7 h-7 text-zinc-600" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-black text-zinc-300 mb-1">Sin mensajes aún</p>
      <p className="text-xs text-zinc-600">Sé el primero en escribir o compartir un boleto.</p>
    </div>
  )
}

function EmptyMembers() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <Icon name="user" className="w-10 h-10 text-zinc-700 mb-3" strokeWidth={1.5} />
      <p className="text-sm font-black text-zinc-400">Sin miembros visibles</p>
      <p className="text-xs text-zinc-600 mt-1">Los participantes aparecerán aquí.</p>
    </div>
  )
}

function EmptyRanking() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <Icon name="leaderboard" className="w-10 h-10 text-zinc-700 mb-3" strokeWidth={1.5} />
      <p className="text-sm font-black text-zinc-400">Ranking en construcción</p>
      <p className="text-xs text-zinc-600 mt-1 max-w-xs">El ranking se calcula con picks registrados. Añade tus apuestas para aparecer aquí.</p>
    </div>
  )
}

function EmptyGroupBets() {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-6">
      <Icon name="ticket" className="w-10 h-10 text-zinc-700 mb-3" strokeWidth={1.5} />
      <p className="text-sm font-black text-zinc-400">Este grupo empieza en blanco</p>
      <p className="text-xs text-zinc-600 mt-1.5 max-w-xs leading-relaxed">
        Para que una apuesta cuente, debes subirla en tu{" "}
        <Link href="/bets" className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2">
          Historial
        </Link>{" "}
        antes de que empiece el partido.
      </p>
    </div>
  )
}

interface Message { id: string; content: string; user_email: string; sender_name: string; sender_avatar?: string; created_at: string }
interface RankingEntry { email: string; name: string; avatar_url?: string; role: string; picks: number; won: number; winrate: number; yield: number; profit: number }
interface Member { email: string; name: string; avatar_url?: string; role: string; joined_at: string }

interface BetLeg { id: string; match: string; selection: string; odds: number; status: string }
interface UserBet { id: string; title: string; stake: number; combined_odds: number; status: string; sport: string; image_url?: string; created_at: string; bet_legs?: BetLeg[] }
interface GroupBetEntry {
  sharedId: string; sharedAt: string; isPreMatch: boolean
  sharedBy: string; sharedByName: string; sharedByAvatar?: string; isOwn: boolean
  bet: UserBet
}
interface GroupBetRankingEntry { email: string; name: string; avatar_url?: string; picks: number; won: number; winrate: number; yield: number; profit: number }

/** Tarjeta de apuesta en el chat (mensajes con formato [bet]{json}[/bet]). */
function BetCard({ raw }: { raw: string }) {
  let data: { match?: string; stake?: number; odds?: number; image?: string | null } = {}
  try { data = JSON.parse(raw) } catch { /* json corrupto → tarjeta mínima */ }
  const ret = (data.stake ?? 0) * (data.odds ?? 0)
  return (
    <div className="w-[230px] rounded-2xl border border-emerald-700/40 bg-gradient-to-b from-emerald-500/[0.10] to-zinc-900/40 overflow-hidden">
      {data.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.image} alt="Ticket" className="w-full max-h-32 object-contain bg-zinc-950 border-b border-white/[0.06]" />
      )}
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <Icon name="ticket" className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2} />
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Apuesta</span>
        </div>
        <p className="text-[13px] font-bold text-white leading-tight">{data.match ?? "Partido"}</p>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-400">
          <span>Stake: <b className="text-white">{data.stake ?? "—"}€</b></span>
          <span>Cuota: <b className="text-emerald-400">@{data.odds ?? "—"}</b></span>
        </div>
        {ret > 0 && <p className="text-[10px] text-zinc-500 mt-1">Retorno potencial: {ret.toFixed(2)}€</p>}
      </div>
    </div>
  )
}

// ── Chat view ─────────────────────────────────────────────────
function ChatView({ group, onBack }: { group: Group; onBack: () => void }) {
  const [tab, setTab] = useState<ChatTab>("chat")
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [sending, setSending] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [rankingLoading, setRankingLoading] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [groupBets, setGroupBets] = useState<GroupBetEntry[]>([])
  const [groupBetsLoading, setGroupBetsLoading] = useState(false)
  const [groupBetsRanking, setGroupBetsRanking] = useState<GroupBetRankingEntry[]>([])
  const [myBets, setMyBets] = useState<UserBet[]>([])
  const [myBetsLoading, setMyBetsLoading] = useState(false)
  const [sharingBetId, setSharingBetId] = useState<string | null>(null)
  const [shareError, setShareError] = useState("")
  const [shareSuccess, setShareSuccess] = useState("")
  const [showSharePicker, setShowSharePicker] = useState(false)
  // ── Flujo OCR de ticket (andamiaje, mock) ──────────────────────────────────
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrData, setOcrData] = useState<ExtractedBet | null>(null)
  const [ocrImageUrl, setOcrImageUrl] = useState<string | null>(null)
  const [showBetModal, setShowBetModal] = useState(false)
  const [savingBet, setSavingBet] = useState(false)
  // ── Separación de historiales en la pestaña de apuestas ────────────────────
  const [betsSubTab, setBetsSubTab] = useState<"group" | "mine">("group")
  const [betsBannerOpen, setBetsBannerOpen] = useState(true)
  const { data: session } = useSession()

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/groups/${group.id}/messages`)
    if (res.ok) { const d = await res.json(); setMessages(d.messages ?? []) }
  }, [group.id])

  useEffect(() => { loadMessages() }, [loadMessages])

  const loadRanking = useCallback(async () => {
    setRankingLoading(true)
    const res = await fetch(`/api/groups/${group.id}/ranking`)
    if (res.ok) { const d = await res.json(); setRanking(d.ranking ?? []) }
    setRankingLoading(false)
  }, [group.id])

  const loadMembers = useCallback(async () => {
    setMembersLoading(true)
    const res = await fetch(`/api/groups/${group.id}/members`)
    if (res.ok) { const d = await res.json(); setMembers(d.members ?? []) }
    setMembersLoading(false)
  }, [group.id])

  const loadGroupBets = useCallback(async () => {
    setGroupBetsLoading(true)
    const res = await fetch(`/api/groups/${group.id}/bets`)
    if (res.ok) {
      const d = await res.json()
      setGroupBets(d.bets ?? [])
      setGroupBetsRanking(d.ranking ?? [])
    }
    setGroupBetsLoading(false)
  }, [group.id])

  const loadMyBets = useCallback(async () => {
    setMyBetsLoading(true)
    const res = await fetch("/api/bets")
    if (res.ok) {
      const d = await res.json()
      // Only show pending bets (pre-match only)
      setMyBets((d.bets ?? []).filter((b: UserBet) => b.status === "pending"))
    }
    setMyBetsLoading(false)
  }, [])

  const shareBet = async (betId: string) => {
    setSharingBetId(betId); setShareError(""); setShareSuccess("")
    const res = await fetch(`/api/groups/${group.id}/bets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bet_id: betId }),
    })
    const d = await res.json()
    setSharingBetId(null)
    if (res.ok) {
      setShareSuccess(d.message ?? "Apuesta compartida")
      setShowSharePicker(false)
      loadGroupBets()
      setTimeout(() => setShareSuccess(""), 3000)
    } else {
      setShareError(d.error ?? "Error al compartir")
    }
  }

  const unshareGroupBet = async (sharedId: string) => {
    await fetch(`/api/groups/${group.id}/bets?sharedId=${sharedId}`, { method: "DELETE" })
    loadGroupBets()
  }

  // FASE 2/3 (sistema de honor): el dueño marca su boleto Ganada/Perdida.
  const [resolvingBet, setResolvingBet] = useState<string | null>(null)
  const resolveGroupBet = async (betId: string, status: "won" | "lost" | "pending") => {
    setResolvingBet(betId)
    // Optimista: refleja el estado en el feed al instante.
    setGroupBets((prev) => prev.map((gb) =>
      gb.bet.id === betId ? { ...gb, bet: { ...gb.bet, status } } : gb))
    try {
      const res = await fetch(`/api/groups/${group.id}/bets/${betId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) { loadGroupBets(); return }   // revertir desde el servidor si falla
      loadGroupBets()   // recarga boletos + ranking recalculado
    } catch {
      loadGroupBets()
    } finally {
      setResolvingBet(null)
    }
  }

  function copyInviteLink() {
    if (!group.invite_code) return
    const msg = `¡Únete a mi grupo "${group.name}" en SportsPicks! Usa el código: ${group.invite_code}\nhttps://sportspicks.vercel.app/groups?code=${group.invite_code}`
    navigator.clipboard.writeText(msg).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2500)
    }).catch(() => {
      // Fallback for browsers that don't support clipboard API
      alert(msg)
    })
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending) return
    setSending(true); setInput("")
    await fetch(`/api/groups/${group.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    })
    setSending(false)
    loadMessages()
    // Refresh ranking in background so score updates after sharing a combinada
    loadRanking()
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || uploadingImage) return
    if (!file.type.startsWith("image/")) return
    if (file.size > 5 * 1024 * 1024) { alert("La imagen no puede superar 5 MB"); return }

    setUploadingImage(true)
    try {
      // Upload via server-side API to Supabase Storage
      const form = new FormData()
      form.append("file", file)
      const uploadRes = await fetch("/api/groups/upload", { method: "POST", body: form })
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}))
        alert(err.error ?? "Error al subir la imagen")
        return
      }
      const { url } = await uploadRes.json()
      // Send as message with the public URL
      await fetch(`/api/groups/${group.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: `[img]${url}[/img]` }),
      })
      loadMessages()
    } catch {
      alert("Error de conexión al subir la imagen")
    } finally {
      setUploadingImage(false)
    }
    // Reset input so the same file can be re-uploaded
    e.target.value = ""
  }

  // ── Flujo OCR: subir ticket → "Analizando…" → modal de confirmación ────────
  const handleBetTicketSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""   // permite re-seleccionar el mismo archivo
    if (!file || ocrLoading) return
    if (!file.type.startsWith("image/")) { alert("El archivo debe ser una imagen."); return }
    if (file.size > 5 * 1024 * 1024) { alert("La imagen no puede superar 5 MB"); return }

    setOcrLoading(true)
    try {
      // Subimos la imagen para tener una URL persistente (preview + tarjeta).
      const form = new FormData()
      form.append("file", file)
      const up = await fetch("/api/groups/upload", { method: "POST", body: form })
      const upJson = up.ok ? await up.json().catch(() => ({})) : {}
      setOcrImageUrl(upJson.url ?? null)

      // OCR REAL: Claude Vision vía Server Action. Ante fallo devuelve nulls
      // (modal vacío para relleno manual) — nunca crashea el cliente.
      const fd = new FormData()
      fd.append("image", file)
      let ocr: { match_text: string | null; odds: number | null; stake: number | null }
      try {
        ocr = await extractBetDataReal(fd)
      } catch {
        ocr = { match_text: null, odds: null, stake: null }
      }

      const detected = ocr.match_text ?? ""
      const data: ExtractedBet = {
        match: detected,
        matchOptions: [
          ...(detected ? [detected] : []),
          "Otro / corregir manualmente",
        ],
        stake: ocr.stake ?? 0,
        odds: ocr.odds ?? 0,
      }
      setOcrData(data)
      setShowBetModal(true)
    } catch {
      alert("No se pudo analizar el ticket. Inténtalo de nuevo.")
    } finally {
      setOcrLoading(false)
    }
  }

  const handleBetConfirm = async (bet: ConfirmedBet) => {
    setSavingBet(true)
    try {
      // Andamiaje: la apuesta confirmada se publica en el chat como tarjeta
      // estructurada (formato [bet]{json}[/bet]) que el render del chat dibuja.
      const payload = JSON.stringify({ ...bet, image: ocrImageUrl ?? null })
      await fetch(`/api/groups/${group.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: `[bet]${payload}[/bet]` }),
      })
      setShowBetModal(false)
      setOcrData(null)
      setOcrImageUrl(null)
      loadMessages()
    } catch {
      alert("No se pudo publicar la apuesta.")
    } finally {
      setSavingBet(false)
    }
  }

  const TABS: { id: ChatTab; label: string; icon: string }[] = [
    { id: "chat",    label: "Chat",         icon: "groups"      },
    { id: "members", label: "Participantes", icon: "user"        },
    { id: "ranking", label: "Ranking",       icon: "leaderboard" },
    { id: "bets",    label: "Mis Apuestas",  icon: "ticket"      },
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.07] bg-zinc-950/80 backdrop-blur-sm shrink-0">
        <button onClick={onBack} className="tap p-1 -ml-1 text-zinc-500 hover:text-white">
          <Icon name="arrowRight" className="w-5 h-5 rotate-180" strokeWidth={2.2} />
        </button>
        <span className="text-2xl">{group.avatar_emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-white truncate">{group.name}</p>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-zinc-600">{group.member_count} miembro{group.member_count !== 1 ? "s" : ""}</p>
            {group.role === "admin" && group.invite_code && (
              <p className="text-[10px] text-zinc-600">
                · Código: <span className="text-emerald-400 font-bold tracking-widest">{group.invite_code}</span>
              </p>
            )}
          </div>
        </div>
        {group.invite_code && (
          <button
            onClick={copyInviteLink}
            className={`tap p-1.5 rounded-lg transition-all ${linkCopied ? "bg-emerald-500/20 text-emerald-400" : "hover:bg-zinc-800 text-zinc-500"}`}
            title="Copiar enlace de invitación"
          >
            {linkCopied
              ? <Icon name="check" className="w-4 h-4" strokeWidth={2.4} />
              : <Icon name="copy" className="w-4 h-4" strokeWidth={2} />
            }
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="shrink-0 flex border-b border-white/[0.07] bg-zinc-950/60">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => {
            setTab(t.id)
            if (t.id === "ranking" && !ranking.length) loadRanking()
            if (t.id === "members" && !members.length) loadMembers()
            if (t.id === "bets") { loadGroupBets(); loadMyBets() }
          }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold tap transition-all border-b-2 ${tab === t.id ? "border-emerald-500 text-white" : "border-transparent text-zinc-600 hover:text-zinc-400"}`}>
            <Icon name={t.icon} className="w-3.5 h-3.5" strokeWidth={2} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 ? <EmptyChat /> : messages.map((msg) => {
              const isMe = msg.user_email === session?.user?.email
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                  <div className="w-7 h-7 rounded-full bg-zinc-800 grid place-items-center text-xs font-bold shrink-0 overflow-hidden">
                    {msg.sender_avatar ? <img src={msg.sender_avatar} className="w-full h-full object-cover" alt="" /> : msg.sender_name?.[0]?.toUpperCase()}
                  </div>
                  <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                    {!isMe && <span className="text-[10px] text-zinc-500 px-1">{msg.sender_name}</span>}
                    {msg.content?.startsWith("[bet]") && msg.content?.endsWith("[/bet]") ? (
                      <BetCard raw={msg.content.slice(5, -6)} />
                    ) : msg.content?.startsWith("[img]") && msg.content?.endsWith("[/img]") ? (
                      <img
                        src={msg.content.slice(5, -6)}
                        alt="imagen"
                        className="max-w-[200px] rounded-xl border border-white/[0.07] cursor-pointer"
                        onClick={() => window.open(msg.content.slice(5, -6), "_blank")}
                      />
                    ) : (
                      <div className={`px-3 py-2 rounded-2xl text-sm ${isMe ? "bg-emerald-600 text-white rounded-tr-sm" : "bg-zinc-800 text-zinc-100 rounded-tl-sm"}`}>
                        {msg.content}
                      </div>
                    )}
                    <span className="text-[9px] text-zinc-700 px-1">
                      {new Date(msg.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          {/* Overlay de análisis OCR */}
          {ocrLoading && (
            <div className="shrink-0 mx-4 mb-2 flex items-center gap-2.5 rounded-xl border border-emerald-700/40 bg-emerald-500/[0.08] px-3.5 py-2.5">
              <span className="inline-block w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin shrink-0" />
              <p className="text-[12px] font-bold text-emerald-300">Analizando ticket con IA…</p>
            </div>
          )}
          {/* Input */}
          <div className="shrink-0 px-4 py-3 border-t border-white/[0.07] bg-zinc-950/80 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              {/* Subir Apuesta (ticket → OCR) */}
              <label className={`tap inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-700/40 text-emerald-400 hover:bg-emerald-500/25 transition-all cursor-pointer shrink-0 ${ocrLoading ? "opacity-40 pointer-events-none" : ""}`}
                title="Subir foto de tu apuesta — la IA leerá las cuotas">
                <input type="file" accept="image/*" className="sr-only" onChange={handleBetTicketSelect} disabled={ocrLoading} />
                <Icon name="ticket" className="w-4 h-4" strokeWidth={2} />
                <span className="text-[11px] font-bold hidden sm:inline">Subir apuesta</span>
              </label>
              {/* Imagen normal */}
              <label className={`tap p-2.5 rounded-xl border border-white/[0.07] hover:border-white/[0.14] text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer shrink-0 ${uploadingImage ? "opacity-40 pointer-events-none" : ""}`}>
                <input type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} disabled={uploadingImage} />
                {uploadingImage ? (
                  <span className="inline-block w-4 h-4 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
                ) : (
                  <Icon name="image" className="w-4 h-4" strokeWidth={2} />
                )}
              </label>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-zinc-800/40 border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/[0.16]"
              />
              <button disabled={!input.trim() || sending} onClick={sendMessage}
                className="tap p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 transition-all">
                <Icon name="arrowRight" className="w-4 h-4" strokeWidth={2.4} />
              </button>
            </div>
          </div>
        </>
      )}

      {tab === "members" && (
        <div className="flex-1 overflow-y-auto">
          {membersLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <EmptyMembers />
          ) : (
            <div className="px-4 pt-4 pb-6 space-y-2">
              {/* Invite link banner for admins */}
              {group.role === "admin" && group.invite_code && (
                <button
                  onClick={copyInviteLink}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${linkCopied ? "border-emerald-700/60 bg-emerald-500/10" : "border-white/[0.07] bg-zinc-900/50 hover:bg-zinc-800/60"}`}
                >
                  <Icon name={linkCopied ? "check" : "share"} className={`w-4 h-4 shrink-0 ${linkCopied ? "text-emerald-400" : "text-zinc-400"}`} strokeWidth={2} />
                  <div className="text-left">
                    <p className={`text-xs font-bold ${linkCopied ? "text-emerald-400" : "text-zinc-300"}`}>
                      {linkCopied ? "¡Enlace copiado!" : "Generar enlace de invitación"}
                    </p>
                    {!linkCopied && <p className="text-[10px] text-zinc-600">Código: <span className="text-emerald-400 font-black tracking-widest">{group.invite_code}</span></p>}
                  </div>
                </button>
              )}
              {members.map((m) => (
                <div key={m.email} className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.07] bg-zinc-900/40">
                  <div className="w-9 h-9 rounded-full bg-zinc-700 grid place-items-center text-sm font-bold shrink-0 overflow-hidden">
                    {m.avatar_url ? <img src={m.avatar_url} className="w-full h-full object-cover" alt="" /> : m.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{m.name}</p>
                    <p className="text-[10px] text-zinc-500">
                      {m.role === "admin" ? "👑 Admin" : "Miembro"} · desde {new Date(m.joined_at).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}
                    </p>
                  </div>
                  {m.email === session?.user?.email && (
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-700/40 px-2 py-0.5 rounded-full font-bold">Tú</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "ranking" && (
        <div className="flex-1 overflow-y-auto">
          {rankingLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            </div>
          ) : ranking.length === 0 ? (
            <EmptyRanking />
          ) : (
            <div className="px-4 pt-4 pb-6 space-y-2">
              {ranking.map((r, i) => (
                <div key={r.email} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-zinc-900/40 p-3">
                  <div className={`w-7 h-7 rounded-full grid place-items-center text-xs font-black shrink-0 ${i === 0 ? "bg-amber-500 text-black" : i === 1 ? "bg-zinc-400 text-black" : i === 2 ? "bg-amber-700 text-white" : "bg-zinc-800 text-zinc-400"}`}>
                    {i + 1}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-zinc-700 grid place-items-center text-xs font-bold shrink-0 overflow-hidden">
                    {r.avatar_url ? <img src={r.avatar_url} className="w-full h-full object-cover" alt="" /> : r.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{r.name}</p>
                    <p className="text-[10px] text-zinc-500">{r.picks} picks · {r.won} ganadas</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-black ${r.yield >= 0 ? "text-emerald-400" : "text-red-400"}`}>{r.yield > 0 ? "+" : ""}{r.yield}%</p>
                    <p className="text-[10px] text-zinc-500">{r.winrate}% WR</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "bets" && (
        <div className="flex-1 overflow-y-auto">
          {groupBetsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-7 h-7 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            </div>
          ) : (
            <div className="px-4 pt-4 pb-24 space-y-4">
              {/* Banner explicativo colapsable */}
              <div className="rounded-xl border border-emerald-800/40 bg-emerald-500/[0.06] overflow-hidden">
                <button onClick={() => setBetsBannerOpen(v => !v)}
                  className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left">
                  <Icon name="spark" className="w-4 h-4 text-emerald-400 shrink-0" strokeWidth={2} />
                  <span className="flex-1 text-[12px] font-bold text-emerald-300">¿Cómo funcionan las apuestas del grupo?</span>
                  <Icon name={betsBannerOpen ? "chevronUp" : "chevronDown"} className="w-4 h-4 text-emerald-400/70 shrink-0" strokeWidth={2} />
                </button>
                {betsBannerOpen && (
                  <p className="px-3.5 pb-3 text-[11.5px] text-zinc-400 leading-relaxed">
                    Sube la captura de tu apuesta. La IA leerá las cuotas y verificaremos los resultados automáticamente.
                  </p>
                )}
              </div>

              {/* Sub-tabs: separación de historiales */}
              <div className="flex gap-1.5 p-1 rounded-xl bg-zinc-900/60 border border-white/[0.06]">
                {([
                  { id: "group", label: "Apuestas del Grupo" },
                  { id: "mine",  label: "Mi Historial" },
                ] as const).map((st) => (
                  <button key={st.id} onClick={() => setBetsSubTab(st.id)}
                    className={`flex-1 py-2 rounded-lg text-[12px] font-bold transition-colors ${betsSubTab === st.id ? "bg-emerald-500/20 text-emerald-300" : "text-zinc-500 hover:text-zinc-300"}`}>
                    {st.label}
                  </button>
                ))}
              </div>

              {betsSubTab === "group" && (
              <div className="space-y-4">
              {/* Share bet CTA — Link real a Mis Apuestas (desde ahí se comparte al grupo) */}
              <Link
                href="/bets"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-emerald-700/50 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 text-xs font-bold tap transition-colors"
              >
                <Icon name="plus" className="w-3.5 h-3.5" strokeWidth={2.5} />
                Compartir apuesta (pre-partido)
              </Link>

              {shareSuccess && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-700/40 bg-emerald-500/[0.08] px-3 py-2.5">
                  <Icon name="check" className="w-4 h-4 text-emerald-400 shrink-0" strokeWidth={2.5} />
                  <p className="text-xs font-bold text-emerald-300">{shareSuccess}</p>
                </div>
              )}

              {shareError && (
                <p className="text-xs text-rose-400 font-bold px-1">{shareError}</p>
              )}

              {/* Bet picker */}
              {showSharePicker && (
                <div className="rounded-xl border border-white/[0.07] bg-zinc-900/60 p-3 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">
                    Mis apuestas pendientes
                  </p>
                  {myBetsLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="w-5 h-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                    </div>
                  ) : myBets.length === 0 ? (
                    <p className="text-xs text-zinc-600 text-center py-4">
                      Sin apuestas pendientes. Ve a <span className="text-emerald-400">Mis Apuestas</span> y registra una antes del partido.
                    </p>
                  ) : (
                    myBets.map(b => {
                      const alreadyShared = groupBets.some(gb => gb.bet.id === b.id)
                      return (
                        <div key={b.id} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-zinc-800/50 px-3 py-2.5">
                          {b.image_url && (
                            <ZoomableImage src={b.image_url} alt="Boleto" className="w-8 h-8 rounded object-cover shrink-0 border border-white/[0.07]" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{b.title}</p>
                            <p className="text-[10px] text-zinc-500">
                              @{b.combined_odds} · {b.bet_legs?.length ?? 0} sel.
                              · {new Date(b.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                            </p>
                          </div>
                          <button
                            disabled={alreadyShared || sharingBetId === b.id}
                            onClick={() => shareBet(b.id)}
                            className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black tap transition-all ${
                              alreadyShared
                                ? "bg-zinc-800 text-zinc-600 cursor-default"
                                : sharingBetId === b.id
                                  ? "bg-emerald-500/20 text-emerald-400 opacity-60"
                                  : "bg-emerald-500/15 border border-emerald-700/40 text-emerald-400 hover:bg-emerald-500/25"
                            }`}
                          >
                            {alreadyShared ? "✓ Compartida" : sharingBetId === b.id ? "…" : "Compartir"}
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* Isolated group ranking (only group-shared bets) */}
              {groupBetsRanking.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-1">
                    Ranking del grupo (picks compartidos)
                  </p>
                  {groupBetsRanking.map((r, i) => (
                    <div key={r.email} className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-zinc-900/40 px-3 py-2.5">
                      <div className={`w-6 h-6 rounded-full grid place-items-center text-[10px] font-black shrink-0 ${i === 0 ? "bg-amber-500 text-black" : i === 1 ? "bg-zinc-400 text-black" : i === 2 ? "bg-amber-700 text-white" : "bg-zinc-800 text-zinc-400"}`}>
                        {i + 1}
                      </div>
                      <div className="w-7 h-7 rounded-full bg-zinc-700 grid place-items-center text-xs font-bold shrink-0 overflow-hidden">
                        {r.avatar_url ? <img src={r.avatar_url} className="w-full h-full object-cover" alt="" /> : r.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{r.name}</p>
                        <p className="text-[10px] text-zinc-500">{r.picks} picks · {r.won} ✓</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-black ${r.yield >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {r.yield > 0 ? "+" : ""}{r.yield}%
                        </p>
                        <p className="text-[10px] text-zinc-500">{r.winrate}% WR</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Shared bets list */}
              {groupBets.length === 0 && !showSharePicker ? (
                <EmptyGroupBets />
              ) : (
                <div className="space-y-2.5">
                  {groupBets.length > 0 && (
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-1">
                      Picks compartidos ({groupBets.length})
                    </p>
                  )}
                  {groupBets.map((gb) => {
                    const bet = gb.bet
                    const STATUS_COLORS: Record<string, string> = {
                      pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
                      won:     "bg-green-500/20  text-green-300  border-green-500/30",
                      lost:    "bg-red-500/20    text-red-300    border-red-500/30",
                      void:    "bg-zinc-500/20   text-zinc-300   border-zinc-500/30",
                    }
                    const STATUS_LABEL: Record<string, string> = { pending: "Pendiente", won: "Ganada", lost: "Perdida", void: "Anulada" }
                    return (
                      <div key={gb.sharedId} className="rounded-2xl border border-white/[0.07] bg-zinc-900/60 overflow-hidden">
                        {/* Shared-by header */}
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.07] bg-zinc-950/30">
                          <div className="w-5 h-5 rounded-full bg-zinc-700 grid place-items-center text-[9px] font-bold overflow-hidden shrink-0">
                            {gb.sharedByAvatar
                              ? <img src={gb.sharedByAvatar} className="w-full h-full object-cover" alt="" />
                              : gb.sharedByName?.[0]?.toUpperCase()
                            }
                          </div>
                          <span className="text-[10px] text-zinc-500 flex-1 truncate">
                            {gb.isOwn ? "Tú" : gb.sharedByName}
                          </span>
                          {gb.isPreMatch && (
                            <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 border border-emerald-700/30 px-1.5 py-0.5 rounded">
                              ✓ Pre-partido
                            </span>
                          )}
                          <span className="text-[9px] text-zinc-700">
                            {new Date(gb.sharedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                          </span>
                          {gb.isOwn && (
                            <button
                              onClick={() => unshareGroupBet(gb.sharedId)}
                              className="tap text-zinc-700 hover:text-rose-400 transition-colors"
                              title="Eliminar del grupo"
                            >
                              <Icon name="trash" className="w-3 h-3" strokeWidth={2} />
                            </button>
                          )}
                        </div>

                        {/* Bet info */}
                        <div className="p-3 flex items-start gap-3">
                          {bet.image_url && (
                            <ZoomableImage src={bet.image_url} alt="Boleto" className="w-12 h-12 rounded-lg object-cover border border-white/[0.07] shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-white truncate">{bet.title}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[bet.status] ?? STATUS_COLORS.void}`}>
                                {STATUS_LABEL[bet.status] ?? bet.status}
                              </span>
                              <span className="text-[10px] text-zinc-500">
                                {bet.stake}€ @ {bet.combined_odds}
                              </span>
                              {bet.status === "won" && (
                                <span className="text-[10px] text-emerald-400 font-bold">
                                  +{((bet.combined_odds - 1) * bet.stake).toFixed(2)}€
                                </span>
                              )}
                            </div>
                            {/* Legs preview */}
                            {bet.bet_legs && bet.bet_legs.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {bet.bet_legs.slice(0, 3).map((leg, li) => (
                                  <div key={li} className="flex items-center gap-1.5 text-[10px]">
                                    <span className="text-zinc-600 truncate flex-1">{leg.match}</span>
                                    <span className="text-zinc-400 font-bold shrink-0">{leg.selection}</span>
                                    <span className="text-emerald-500 font-mono shrink-0">@{Number(leg.odds).toFixed(2)}</span>
                                  </div>
                                ))}
                                {bet.bet_legs.length > 3 && (
                                  <p className="text-[9px] text-zinc-700">+{bet.bet_legs.length - 3} selecciones más</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* FASE 3 — Resolución manual (sistema de honor): solo el
                            DUEÑO y mientras el boleto siga pendiente. */}
                        {gb.isOwn && bet.status === "pending" && (
                          <div className="flex gap-2 px-3 pb-3">
                            <button
                              onClick={() => resolveGroupBet(bet.id, "won")}
                              disabled={resolvingBet === bet.id}
                              className="flex-1 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-bold tap disabled:opacity-40 transition-colors"
                            >
                              ✅ Marcar Ganada
                            </button>
                            <button
                              onClick={() => resolveGroupBet(bet.id, "lost")}
                              disabled={resolvingBet === bet.id}
                              className="flex-1 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-bold tap disabled:opacity-40 transition-colors"
                            >
                              ❌ Marcar Perdida
                            </button>
                          </div>
                        )}
                        {/* Deshacer: vuelve a pendiente (solo el dueño, ya resuelto). */}
                        {gb.isOwn && (bet.status === "won" || bet.status === "lost") && (
                          <div className="px-3 pb-3 -mt-1">
                            <button
                              onClick={() => resolveGroupBet(bet.id, "pending")}
                              disabled={resolvingBet === bet.id}
                              className="text-[10px] text-zinc-500 hover:text-zinc-300 tap disabled:opacity-40 transition-colors"
                            >
                              ↩︎ Deshacer
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Info banner */}
              <div className="rounded-xl border border-emerald-800/30 bg-emerald-500/5 px-3.5 py-2.5">
                <p className="text-[10px] text-emerald-400/70 font-bold">🔒 Solo picks pre-partido</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">
                  El servidor valida que la apuesta sea pendiente al compartirla. Los resultados cuentan en el ranking aislado del grupo.
                </p>
              </div>
              </div>
              )}

              {/* ── Mi Historial ── */}
              {betsSubTab === "mine" && (
                <div className="space-y-2">
                  {myBetsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-6 h-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                    </div>
                  ) : myBets.length === 0 ? (
                    <p className="text-xs text-zinc-600 text-center py-10">
                      Aún no tienes apuestas registradas.
                    </p>
                  ) : (
                    myBets.map((b) => (
                      <div key={b.id} className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-zinc-900/40 px-3 py-2.5">
                        {b.image_url && <img src={b.image_url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 border border-white/[0.07]" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">{b.title}</p>
                          <p className="text-[10px] text-zinc-500">
                            {b.stake}€ @{b.combined_odds} · {new Date(b.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          b.status === "won" ? "bg-emerald-500/15 text-emerald-400"
                          : b.status === "lost" ? "bg-rose-500/15 text-rose-400"
                          : "bg-zinc-700/40 text-zinc-400"
                        }`}>
                          {b.status === "won" ? "Ganada" : b.status === "lost" ? "Perdida" : "Pendiente"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de confirmación tras el OCR del ticket */}
      <BetConfirmationModal
        open={showBetModal}
        data={ocrData}
        imagePreview={ocrImageUrl}
        saving={savingBet}
        onConfirm={handleBetConfirm}
        onClose={() => { setShowBetModal(false); setOcrData(null); setOcrImageUrl(null) }}
      />
    </div>
  )
}

// ── Group list item ───────────────────────────────────────────
function GroupItem({ group, onClick }: { group: Group; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-900/60 tap transition-colors border-b border-white/[0.07] text-left">
      <div className="w-11 h-11 rounded-2xl bg-zinc-800 border border-white/[0.07] grid place-items-center text-2xl shrink-0">
        {group.avatar_emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-black text-white truncate">{group.name}</p>
          {group.last_message_at && <span className="text-[10px] text-zinc-600 shrink-0">{group.last_message_at}</span>}
        </div>
        <p className="text-xs text-zinc-500 truncate mt-0.5">{group.last_message ?? "Sin mensajes aún"}</p>
      </div>
      {group.unread > 0 && (
        <span className="w-5 h-5 rounded-full bg-emerald-500 text-[10px] font-black text-white grid place-items-center shrink-0">
          {group.unread}
        </span>
      )}
    </button>
  )
}

// ── Create modal ──────────────────────────────────────────────
function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("")
  const [emoji, setEmoji] = useState("⚽")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const EMOJIS = ["⚽","🏀","🎾","🏈","⚾","🏐","🏉","🎱","🔥","⚡","🏆","💎"]

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true); setError("")
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), emoji }),
    })
    setSaving(false)
    if (res.ok) { onCreated(); onClose() }
    else { const d = await res.json(); setError(d.error ?? "Error al crear") }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm mx-4 sm:mx-auto rounded-2xl border border-white/[0.07] bg-zinc-950 p-5 space-y-4 mb-20 sm:mb-0">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-white">Nuevo grupo</h3>
          <button onClick={onClose} className="tap p-1 text-zinc-500 hover:text-white">
            <Icon name="close" className="w-4 h-4" strokeWidth={2.2} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => setEmoji(e)}
              className={`w-9 h-9 rounded-xl text-xl tap transition-all ${emoji === e ? "bg-emerald-500/20 border-2 border-emerald-500/60" : "bg-zinc-900 border border-white/[0.07] hover:border-white/[0.14]"}`}>
              {e}
            </button>
          ))}
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del grupo" maxLength={40}
          className="w-full bg-zinc-800/40 border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/[0.16]" />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button disabled={!name.trim() || saving} onClick={handleCreate}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-bold text-sm tap transition-all">
          {saving ? "Creando…" : "Crear grupo"}
        </button>
      </div>
    </div>
  )
}

// ── Join modal ────────────────────────────────────────────────
function JoinGroupModal({ onClose, onJoined }: { onClose: () => void; onJoined: () => void }) {
  const [code, setCode] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleJoin = async () => {
    if (code.length < 4) return
    setSaving(true); setError("")
    const res = await fetch("/api/groups/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: code }),
    })
    setSaving(false)
    if (res.ok) { onJoined(); onClose() }
    else { const d = await res.json(); setError(d.error ?? "Código inválido") }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm mx-4 sm:mx-auto rounded-2xl border border-white/[0.07] bg-zinc-950 p-5 space-y-4 mb-20 sm:mb-0">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-white">Unirse a un grupo</h3>
          <button onClick={onClose} className="tap p-1 text-zinc-500 hover:text-white">
            <Icon name="close" className="w-4 h-4" strokeWidth={2.2} />
          </button>
        </div>
        <p className="text-xs text-zinc-500">Introduce el código de invitación que te compartió el administrador.</p>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXXXX" maxLength={6}
          className="w-full text-center text-2xl font-black tracking-[0.3em] bg-zinc-800/40 border border-white/[0.08] rounded-xl px-3.5 py-3 text-white placeholder:text-zinc-700 focus:outline-none focus:border-white/[0.16] uppercase" />
        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        <button disabled={code.length < 4 || saving} onClick={handleJoin}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-bold text-sm tap transition-all">
          {saving ? "Uniéndose…" : "Unirse"}
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function GroupsPage() {
  const { status } = useSession()
  const [activeGroup, setActiveGroup] = useState<Group | null>(null)
  const [showCreate, setShowCreate]   = useState(false)
  const [showJoin, setShowJoin]       = useState(false)
  const [groups, setGroups]           = useState<Group[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true)
    const res = await fetch("/api/groups")
    if (res.ok) {
      const d = await res.json()
      setGroups((d.groups ?? []).map((g: any) => ({
        ...g,
        avatar_emoji: g.emoji ?? "⚽",
        role: g.my_role ?? "member",
        unread: 0,
        last_message: null,
        last_message_at: null,
      })))
    }
    setLoadingGroups(false)
  }, [])

  useEffect(() => {
    if (status === "authenticated") loadGroups()
  }, [status, loadGroups])

  if (status === "unauthenticated") {
    return (
      <div className="safe-x flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Icon name="groups" className="w-12 h-12 text-zinc-700 mb-4" strokeWidth={1.5} />
        <h2 className="text-lg font-black text-white mb-2">Inicia sesión para ver tus grupos</h2>
        <p className="text-sm text-zinc-500 mb-6">Crea grupos con amigos, comparte boletos y compite en el ranking interno.</p>
        <Link href="/auth/signin" className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm tap">
          Iniciar sesión
        </Link>
      </div>
    )
  }

  if (activeGroup) return <ChatView group={activeGroup} onBack={() => setActiveGroup(null)} />

  return (
    <div className="safe-x pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <div>
          <span className="section-label">Comunidad</span>
          <h1 className="text-xl font-black text-white mt-0.5">Mis grupos</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowJoin(true)}
            className="tap px-3 py-2 rounded-xl border border-white/[0.07] hover:border-white/[0.14] bg-zinc-900/60 text-zinc-400 text-xs font-bold">
            + Unirse
          </button>
          <button onClick={() => setShowCreate(true)}
            className="tap px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
            + Crear
          </button>
        </div>
      </div>

      {loadingGroups ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        </div>
      ) : groups.length > 0 ? (
        <div className="border-t border-white/[0.07]">
          {groups.map((g) => <GroupItem key={g.id} group={g} onClick={() => setActiveGroup(g)} />)}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/[0.07] grid place-items-center mb-4">
            <Icon name="groups" className="w-8 h-8 text-zinc-600" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-black text-zinc-300 mb-1">Sin grupos aún</p>
          <p className="text-xs text-zinc-600 mb-6">Crea un grupo o únete con un código de invitación.</p>
          <div className="flex gap-2">
            <button onClick={() => setShowJoin(true)}
              className="tap px-4 py-2.5 rounded-xl border border-white/[0.07] hover:border-white/[0.14] text-zinc-400 text-sm font-bold">
              Unirse
            </button>
            <button onClick={() => setShowCreate(true)}
              className="tap px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold">
              Crear grupo
            </button>
          </div>
        </div>
      )}

      {/* Leaderboard teaser */}
      <div className="mx-4 mt-6 mb-8 rounded-2xl border border-amber-700/40 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Icon name="leaderboard" className="w-4 h-4 text-amber-400" strokeWidth={2} />
          <span className="text-xs font-black text-amber-300 uppercase tracking-widest">Leaderboard de grupo</span>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Cada grupo tiene su ranking interno: winrate, yield y racha. Registra tus picks y compite con tus amigos.
        </p>
      </div>

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} onCreated={loadGroups} />}
      {showJoin   && <JoinGroupModal  onClose={() => setShowJoin(false)}   onJoined={loadGroups}  />}
    </div>
  )
}
