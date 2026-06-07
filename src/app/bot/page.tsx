"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import type { BotMessage, HistoryEntry } from "@/lib/bot-api"
import { streamChat } from "@/lib/bot-api"
import { MessageBubble } from "@/components/bot/MessageBubble"
import { ChatInput } from "@/components/bot/ChatInput"
import { Icon } from "@/components/ui/icons"
import { usePlan } from "@/lib/plan"

const FREE_LIMIT = 1
const FREE_USED_KEY = "sp_bot_used" // clave permanente (no diaria)

const WELCOME: BotMessage = {
  id: "welcome",
  role: "assistant",
  content: `¡Hola! Soy el **Bot IA de SportsPicks** 🤖

Analizo tus combinadas con **datos reales de nuestra base de datos**:

- 📸 **Sube una foto** de tu boleto
- 🖼️ **Pega una imagen** (Ctrl/Cmd+V)
- 💬 **Pregúntame** sobre equipos, mercados o un partido

Para cada selección consulto clasificación, forma reciente y H2H reales. Nunca invento datos.

¿Por dónde empezamos?`,
  timestamp: new Date(),
}

export default function BotPage() {
  const { isPremium } = usePlan()
  const [messages, setMessages] = useState<BotMessage[]>([WELCOME])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [usedFree, setUsedFree] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { setUsedFree(Number(localStorage.getItem(FREE_USED_KEY) || 0)) } catch {}
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const limitReached = !isPremium && usedFree >= FREE_LIMIT

  const markFreeUsed = () => {
    const n = usedFree + 1
    setUsedFree(n)
    try { localStorage.setItem(FREE_USED_KEY, String(n)) } catch {}
  }

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
          if (!isPremium) markFreeUsed()
        },
        onError: (err) => {
          if (err === "free_limit") {
            // El servidor bloqueó — sincronizar estado local y mostrar paywall
            markFreeUsed()
            setMessages((prev) => prev.filter((m) => m.id !== assistantId))
            setIsStreaming(false)
            return
          }
          setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: `❌ Error: ${err}` } : m))
          setIsStreaming(false)
        },
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, isStreaming, isPremium, usedFree, limitReached],
  )

  function newConversation() {
    setMessages([WELCOME])
    setHistory([])
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <header className="glass border-b border-white/[0.07] safe-top">
        <div className="flex items-center gap-3 h-14 px-3">
          <Link href="/" aria-label="Volver"
            className="grid place-items-center w-9 h-9 rounded-lg text-zinc-400 hover:bg-zinc-800 tap">
            <Icon name="arrowRight" className="w-5 h-5 rotate-180" strokeWidth={2} />
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-violet-400/10 text-violet-400/90">
              <Icon name="bot" className="w-5 h-5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white leading-tight">Bot IA</p>
              <p className="text-[10px] text-zinc-500 leading-tight flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Análisis con datos reales de nuestra base de datos
              </p>
            </div>
          </div>
          <button onClick={newConversation}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 bg-white/[0.05] hover:bg-white/[0.08] px-3 py-2 rounded-lg tap transition-colors">
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
      <div className="border-t border-white/[0.07] bg-zinc-950 px-3 pt-3 pb-3 safe-bottom">
        <div className="max-w-2xl mx-auto">
          {limitReached ? (
            <div className="rounded-2xl bg-emerald-400/[0.07] p-5 text-center">
              <Icon name="crown" className="w-6 h-6 text-emerald-400/90 mx-auto mb-1.5" />
              <p className="text-sm font-semibold text-white">Has usado tu análisis gratuito</p>
              <p className="text-xs text-zinc-400 mt-0.5 mb-3.5">El bot es ilimitado con Premium. ¡Hazte Premium!</p>
              <Link href="/pricing"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm tap transition-colors">
                Desbloquear Bot ilimitado
              </Link>
            </div>
          ) : (
            <>
              <ChatInput onSend={handleSend} disabled={isStreaming}
                placeholder="Sube tu boleto 📸 o pregunta algo…" />
              <div className="flex items-center justify-between mt-2 px-1">
                <p className="text-[10px] text-zinc-700">Arrastra una imagen · Ctrl+V para pegar</p>
                {!isPremium && usedFree < FREE_LIMIT && (
                  <p className="text-[10px] text-zinc-600">1 análisis gratuito disponible</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
