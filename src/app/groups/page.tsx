"use client"

import { useState } from "react"
import { Icon } from "@/components/ui/icons"
import { useSession } from "next-auth/react"
import Link from "next/link"

// ── Types (local until API is wired) ─────────────────────────
interface Group {
  id: string
  name: string
  avatar_emoji: string
  member_count: number
  last_message: string | null
  last_message_at: string | null
  unread: number
  role: "admin" | "member"
}

interface Message {
  id: string
  user_email: string
  user_name: string
  message_text: string | null
  created_at: string
  bet?: {
    title: string | null
    odds: number
    status: string
    legs: number
  } | null
}

// ── Placeholder data ─────────────────────────────────────────
const PLACEHOLDER_GROUPS: Group[] = [
  { id: "1", name: "Los Cracks", avatar_emoji: "🔥", member_count: 5, last_message: "Le metemos al Real Madrid?", last_message_at: "02:10", unread: 3, role: "admin" },
  { id: "2", name: "Combinadas Pro", avatar_emoji: "⚽", member_count: 12, last_message: "Combinada de hoy: 3 legs @3.40", last_message_at: "01:45", unread: 0, role: "member" },
]

const PLACEHOLDER_MESSAGES: Message[] = [
  { id: "1", user_email: "carlos@ex.com", user_name: "Carlos", message_text: "Vais con el Over 2.5?", created_at: "02:05", bet: null },
  { id: "2", user_email: "me@me.com", user_name: "Tú", message_text: null, created_at: "02:08", bet: { title: "Over 2.5 Real Madrid vs Barça", odds: 1.75, status: "pending", legs: 1 } },
  { id: "3", user_email: "carlos@ex.com", user_name: "Carlos", message_text: "Buena! Le meto también", created_at: "02:10", bet: null },
]

// ── Bet ticket bubble ─────────────────────────────────────────
function BetTicketBubble({ bet }: { bet: NonNullable<Message["bet"]> }) {
  const statusColor = { pending: "text-amber-400 border-amber-700/40 bg-amber-500/10", won: "text-emerald-400 border-emerald-700/40 bg-emerald-500/10", lost: "text-rose-400 border-rose-700/40 bg-rose-500/10" }[bet.status] ?? "text-zinc-400 border-zinc-700 bg-zinc-800"

  return (
    <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/60 p-3 max-w-[220px] space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Icon name="ticket" className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2} />
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Boleto compartido</span>
      </div>
      <p className="text-xs font-bold text-white leading-snug">{bet.title ?? "Apuesta"}</p>
      <div className="flex items-center gap-2">
        <span className="text-sm font-black text-emerald-400">@{bet.odds.toFixed(2)}</span>
        <span className="text-[10px] text-zinc-600">{bet.legs} {bet.legs === 1 ? "selección" : "selecciones"}</span>
        <span className={`ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-md border ${statusColor}`}>
          {bet.status.toUpperCase()}
        </span>
      </div>
    </div>
  )
}

// ── Chat view ─────────────────────────────────────────────────
function ChatView({ group, onBack }: { group: Group; onBack: () => void }) {
  const { data: session } = useSession()
  const [input, setInput] = useState("")
  const myEmail = (session?.user as any)?.email ?? ""

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm shrink-0">
        <button onClick={onBack} className="tap p-1 -ml-1 text-zinc-500 hover:text-white">
          <Icon name="arrowRight" className="w-5 h-5 rotate-180" strokeWidth={2.2} />
        </button>
        <span className="text-2xl">{group.avatar_emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-white truncate">{group.name}</p>
          <p className="text-[10px] text-zinc-600">{group.member_count} miembros</p>
        </div>
        {group.role === "admin" && (
          <button className="tap p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500">
            <Icon name="settings" className="w-4 h-4" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {PLACEHOLDER_MESSAGES.map((msg) => {
          const isMe = msg.user_email === myEmail || msg.user_name === "Tú"
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
              {!isMe && (
                <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 grid place-items-center text-[11px] font-black text-zinc-400 shrink-0">
                  {msg.user_name[0]}
                </div>
              )}
              <div className={`max-w-[75%] space-y-0.5 ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                {!isMe && <span className="text-[10px] text-zinc-600 px-1">{msg.user_name}</span>}
                {msg.bet ? (
                  <BetTicketBubble bet={msg.bet} />
                ) : (
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${isMe ? "bg-emerald-600/20 border border-emerald-700/40 text-emerald-100 rounded-tr-sm" : "bg-zinc-800/80 border border-zinc-700/50 text-zinc-200 rounded-tl-sm"}`}>
                    {msg.message_text}
                  </div>
                )}
                <span className="text-[9px] text-zinc-700 px-1">{msg.created_at}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 py-3 border-t border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button className="tap p-2 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900 text-zinc-500 hover:text-emerald-400 transition-colors">
            <Icon name="ticket" className="w-4 h-4" strokeWidth={2} />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
          />
          <button
            disabled={!input.trim()}
            className="tap p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 transition-all"
          >
            <Icon name="arrowRight" className="w-4 h-4" strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Group list item ───────────────────────────────────────────
function GroupItem({ group, onClick }: { group: Group; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-900/60 tap transition-colors border-b border-zinc-800/40 text-left">
      <div className="w-11 h-11 rounded-2xl bg-zinc-800 border border-zinc-700/50 grid place-items-center text-2xl shrink-0">
        {group.avatar_emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-black text-white truncate">{group.name}</p>
          <span className="text-[10px] text-zinc-600 shrink-0">{group.last_message_at}</span>
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

// ── Create group modal ────────────────────────────────────────
function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const [name, setName]   = useState("")
  const [emoji, setEmoji] = useState("⚽")
  const EMOJIS = ["⚽","🏀","🎾","🏈","⚾","🏐","🏉","🎱","🔥","⚡","🏆","💎"]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm mx-4 sm:mx-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-4 mb-4 sm:mb-0">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-white">Nuevo grupo</h3>
          <button onClick={onClose} className="tap p-1 text-zinc-500 hover:text-white">
            <Icon name="close" className="w-4 h-4" strokeWidth={2.2} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => setEmoji(e)}
              className={`w-9 h-9 rounded-xl text-xl tap transition-all ${emoji === e ? "bg-emerald-500/20 border-2 border-emerald-500/60" : "bg-zinc-900 border border-zinc-800 hover:border-zinc-700"}`}>
              {e}
            </button>
          ))}
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del grupo"
          maxLength={40}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
        />

        <button
          disabled={!name.trim()}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-bold text-sm tap transition-all"
        >
          Crear grupo
        </button>
      </div>
    </div>
  )
}

// ── Join group modal ──────────────────────────────────────────
function JoinGroupModal({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState("")
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm mx-4 sm:mx-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-4 mb-4 sm:mb-0">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-white">Unirse a un grupo</h3>
          <button onClick={onClose} className="tap p-1 text-zinc-500 hover:text-white">
            <Icon name="close" className="w-4 h-4" strokeWidth={2.2} />
          </button>
        </div>
        <p className="text-xs text-zinc-500">Introduce el código de invitación que te compartió el administrador.</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXXXX"
          maxLength={6}
          className="w-full text-center text-2xl font-black tracking-[0.3em] bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-3 text-white placeholder:text-zinc-700 focus:outline-none focus:border-zinc-700 uppercase"
        />
        <button
          disabled={code.length < 4}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-bold text-sm tap transition-all"
        >
          Unirse
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function GroupsPage() {
  const { status } = useSession()
  const [activeGroup, setActiveGroup]   = useState<Group | null>(null)
  const [showCreate, setShowCreate]     = useState(false)
  const [showJoin, setShowJoin]         = useState(false)

  if (status === "unauthenticated") {
    return (
      <div className="safe-x flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Icon name="groups" className="w-12 h-12 text-zinc-700 mb-4" strokeWidth={1.5} />
        <h2 className="text-lg font-black text-white mb-2">Inicia sesión para acceder a los grupos</h2>
        <p className="text-sm text-zinc-500 mb-6">Crea grupos con amigos, comparte boletos y compite en el leaderboard interno.</p>
        <Link href="/auth/signin" className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm tap">
          Iniciar sesión
        </Link>
      </div>
    )
  }

  if (activeGroup) {
    return <ChatView group={activeGroup} onBack={() => setActiveGroup(null)} />
  }

  return (
    <div className="safe-x">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <div>
          <span className="section-label">Comunidad</span>
          <h1 className="text-xl font-black text-white mt-0.5">Mis grupos</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowJoin(true)}
            className="tap px-3 py-2 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 text-zinc-400 text-xs font-bold">
            + Unirse
          </button>
          <button onClick={() => setShowCreate(true)}
            className="tap px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
            + Crear
          </button>
        </div>
      </div>

      {/* Group list */}
      {PLACEHOLDER_GROUPS.length > 0 ? (
        <div className="border-t border-zinc-800/40">
          {PLACEHOLDER_GROUPS.map((g) => (
            <GroupItem key={g.id} group={g} onClick={() => setActiveGroup(g)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 grid place-items-center mb-4">
            <Icon name="groups" className="w-8 h-8 text-zinc-600" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-black text-zinc-300 mb-1">Sin grupos aún</p>
          <p className="text-xs text-zinc-600 mb-6">Crea un grupo o únete con un código de invitación.</p>
          <div className="flex gap-2">
            <button onClick={() => setShowJoin(true)}
              className="tap px-4 py-2.5 rounded-xl border border-zinc-800 hover:border-zinc-700 text-zinc-400 text-sm font-bold">
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
        <div className="flex items-center gap-3 mb-2">
          <Icon name="leaderboard" className="w-4 h-4 text-amber-400" strokeWidth={2} />
          <span className="text-xs font-black text-amber-300 uppercase tracking-widest">Leaderboard de grupo</span>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Cada grupo tiene su ranking interno: winrate, yield y racha. Compite con tus amigos semana a semana.
        </p>
      </div>

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} />}
      {showJoin   && <JoinGroupModal  onClose={() => setShowJoin(false)}   />}
    </div>
  )
}
