"use client"

import { useState } from "react"
import { Icon } from "@/components/ui/icons"
import { useSession } from "next-auth/react"
import Link from "next/link"

// ── Types ─────────────────────────────────────────────────────
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

type ChatTab = "chat" | "members" | "ranking"

// ── Empty states ──────────────────────────────────────────────
function EmptyChat() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center px-6 py-12">
      <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 grid place-items-center mb-3">
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

// ── Chat view ─────────────────────────────────────────────────
function ChatView({ group, onBack }: { group: Group; onBack: () => void }) {
  const [tab, setTab] = useState<ChatTab>("chat")
  const [input, setInput] = useState("")

  const TABS: { id: ChatTab; label: string; icon: string }[] = [
    { id: "chat",    label: "Chat",         icon: "groups"      },
    { id: "members", label: "Participantes", icon: "user"        },
    { id: "ranking", label: "Ranking",       icon: "leaderboard" },
  ]

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
          <p className="text-[10px] text-zinc-600">{group.member_count} miembro{group.member_count !== 1 ? "s" : ""}</p>
        </div>
        {group.role === "admin" && (
          <button className="tap p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500">
            <Icon name="settings" className="w-4 h-4" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="shrink-0 flex border-b border-zinc-800/60 bg-zinc-950/60">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold tap transition-all border-b-2 ${tab === t.id ? "border-emerald-500 text-white" : "border-transparent text-zinc-600 hover:text-zinc-400"}`}>
            <Icon name={t.icon} className="w-3.5 h-3.5" strokeWidth={2} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto">
            <EmptyChat />
          </div>
          {/* Input */}
          <div className="shrink-0 px-4 py-3 border-t border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <button className="tap p-2 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900 text-zinc-500 hover:text-emerald-400 transition-colors" title="Compartir boleto">
                <Icon name="ticket" className="w-4 h-4" strokeWidth={2} />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
              />
              <button disabled={!input.trim()}
                className="tap p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 transition-all">
                <Icon name="arrowRight" className="w-4 h-4" strokeWidth={2.4} />
              </button>
            </div>
            <p className="text-[9px] text-zinc-700 mt-1.5 text-center">El chat en tiempo real se activa en la próxima fase.</p>
          </div>
        </>
      )}

      {tab === "members" && (
        <div className="flex-1 overflow-y-auto">
          <EmptyMembers />
        </div>
      )}

      {tab === "ranking" && (
        <div className="flex-1 overflow-y-auto">
          {/* Ranking header info */}
          <div className="px-4 pt-4 pb-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Picks",    value: "—" },
                { label: "Winrate",  value: "—" },
                { label: "Yield",    value: "—" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-2.5">
                  <p className="text-lg font-black text-zinc-400">{s.value}</p>
                  <p className="text-[10px] text-zinc-600">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          <EmptyRanking />
        </div>
      )}
    </div>
  )
}

// ── Group list item ───────────────────────────────────────────
function GroupItem({ group, onClick }: { group: Group; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-900/60 tap transition-colors border-b border-zinc-800/40 text-left">
      <div className="w-11 h-11 rounded-2xl bg-zinc-800 border border-zinc-700/50 grid place-items-center text-2xl shrink-0">
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
function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("")
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
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del grupo" maxLength={40}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700" />
        <button disabled={!name.trim()}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-bold text-sm tap transition-all">
          Crear grupo
        </button>
        <p className="text-[10px] text-zinc-700 text-center">La creación real se activa en la próxima fase.</p>
      </div>
    </div>
  )
}

// ── Join modal ────────────────────────────────────────────────
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
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXXXX" maxLength={6}
          className="w-full text-center text-2xl font-black tracking-[0.3em] bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-3 text-white placeholder:text-zinc-700 focus:outline-none focus:border-zinc-700 uppercase" />
        <button disabled={code.length < 4}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-bold text-sm tap transition-all">
          Unirse
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
  const groups: Group[] = [] // populated from API in Phase 3

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

      {groups.length > 0 ? (
        <div className="border-t border-zinc-800/40">
          {groups.map((g) => <GroupItem key={g.id} group={g} onClick={() => setActiveGroup(g)} />)}
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
        <div className="flex items-center gap-2 mb-1.5">
          <Icon name="leaderboard" className="w-4 h-4 text-amber-400" strokeWidth={2} />
          <span className="text-xs font-black text-amber-300 uppercase tracking-widest">Leaderboard de grupo</span>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Cada grupo tiene su ranking interno: winrate, yield y racha. Registra tus picks y compite con tus amigos.
        </p>
      </div>

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} />}
      {showJoin   && <JoinGroupModal  onClose={() => setShowJoin(false)}   />}
    </div>
  )
}
