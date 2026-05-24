"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import type { BotMessage, HistoryEntry } from "@/lib/bot-api"
import { streamChat } from "@/lib/bot-api"
import { MessageBubble } from "@/components/bot/MessageBubble"
import { ChatInput } from "@/components/bot/ChatInput"
import { Icon } from "@/components/ui/icons"
import { usePlan } from "@/lib/plan"

const FREE_LIMIT = 3

const WELCOME: BotMessage = {
  id: "welcome",
  role: "assistant",
  content: `¡Hola! Soy el **Bot IA de SportsPicks** 🤖

Analizo tus combinadas con **datos reales de ESPN**:

- 📸 **Sube una foto** de tu boleto
- 🖼️ **Pega una imagen** (Ctrl/Cmd+V)
- 💬 **Pregúntame** sobre equipos, mercados o un partido

Para cada selección consulto clasificación, forma reciente y H2H reales. Nunca invento datos.

¿Por dónde empezamos?`,
  timestamp: new Date(),
}

function todayKey() {
  return "sp_bot_" + new Date().toISOString().split("T")[0]
}

export default function BotPage() {
  const { isPremium } = usePlan()
  const [messages, setMessages] = useState<BotMessage[]>([WELCOME])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [usedToday, setUsedToday] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { setUsedToday(Number(localStorage.getItem(todayKey()) || 0)) } catch {}
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const limitReached = !isPremium && usedToday >= FREE_LIMIT

  const handleSend = useCallback(
    async (text: string, image?: File) => {
      if (isStreaming || limitReached) return

      const userMsg: BotMessage = {
        id: crypto.randomUUID(), role: "user", content: text,
        imageUrl: image ? URL.createObjectURL(image) : undefined, timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMsg])

      const assistantId = crypto.randomUUID()
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", timestamp: new Date() }])
      setIsStreaming(true)

      let accumulated = ""
      await streamChat({
        message: text, image, history,
        onToken: (chunk) => {
          accumulated += chunk
          setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: accumulated } : m))
        },
        onDone: () => {
          setHistory((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: accumulated }])
          setIsStreaming(false)
          if (!isPremium) {
            const n = usedToday + 1
            setUsedToday(n)
            try { localStorage.setItem(todayKey(), String(n)) } catch {}
          }
        },
        onError: (err) => {
          setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: `❌ Error: ${err}` } : m))
          setIsStreaming(false)
        },
      })
    },
    [history, isStreaming, isPremium, usedToday, limitReached],
  )

  function newConversation() {
    setMessages([WELCOME])
    setHistory([])
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <header className="glass border-b border-zinc-800/80 safe-top">
        <div className="flex items-center gap-3 h-14 px-3">
          <Link href="/" aria-label="Volver"
            className="grid place-items-center w-9 h-9 rounded-lg text-zinc-400 hover:bg-zinc-800 tap">
            <Icon name="arrowRight" className="w-5 h-5 rotate-180" strokeWidth={2} />
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-emerald-500/10 border border-violet-700/40 text-violet-300">
              <Icon name="bot" className="w-5 h-5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black text-white leading-tight">Bot IA</p>
              <p className="text-[10px] text-zinc-500 leading-tight flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Análisis con datos reales de ESPN
              </p>
            </div>
          </div>
          <button onClick={newConversation}
            className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-lg tap">
            <Icon name="close" className="w-3.5 h-3.5" strokeWidth={2.4} /> Nueva
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg, idx) => (
            <MessageBubble key={msg.id} message={msg}
              isStreaming={isStreaming && idx === messages.length - 1 && msg.role === "assistant"} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input / paywall */}
      <div className="border-t border-zinc-800/80 bg-zinc-950 px-3 pt-3 pb-3 safe-bottom">
        <div className="max-w-2xl mx-auto">
          {limitReached ? (
            <div className="rounded-2xl border border-emerald-800/50 bg-gradient-to-r from-emerald-500/10 to-cyan-500/5 p-4 text-center">
              <Icon name="crown" className="w-6 h-6 text-emerald-400 mx-auto mb-1.5" />
              <p className="text-sm font-bold text-white">Has usado tus 3 análisis gratis de hoy</p>
              <p className="text-xs text-zinc-400 mt-0.5 mb-3">Con Premium el Bot IA es ilimitado.</p>
              <Link href="/pricing"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-zinc-950 font-bold text-sm tap">
                Desbloquear Bot ilimitado
              </Link>
            </div>
          ) : (
            <>
              <ChatInput onSend={handleSend} disabled={isStreaming}
                placeholder="Sube tu boleto 📸 o pregunta algo…" />
              <div className="flex items-center justify-between mt-2 px-1">
                <p className="text-[10px] text-zinc-700">Arrastra una imagen · Ctrl+V para pegar</p>
                {!isPremium && (
                  <p className="text-[10px] text-zinc-600">{Math.max(0, FREE_LIMIT - usedToday)} análisis gratis hoy</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
