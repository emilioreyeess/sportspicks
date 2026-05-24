"use client"

import type { BotMessage } from "@/lib/bot-api"
import { MarkdownMessage } from "./MarkdownMessage"

interface Props {
  message: BotMessage
  isStreaming?: boolean
}

export function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] space-y-2">
          {message.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={message.imageUrl}
              alt="Combinada subida"
              className="rounded-xl max-h-48 object-contain ml-auto border border-zinc-700"
            />
          )}
          {message.content && (
            <div className="bg-zinc-800 text-white text-sm rounded-2xl rounded-tr-md px-4 py-2.5 leading-relaxed">
              {message.content}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Assistant message
  return (
    <div className="flex gap-3 items-start">
      {/* Bot avatar */}
      <div className="shrink-0 h-8 w-8 rounded-xl bg-emerald-500/20 border border-emerald-700
        flex items-center justify-center text-base mt-0.5">
        🤖
      </div>

      <div className="flex-1 min-w-0">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-md px-4 py-3">
          <MarkdownMessage content={message.content} />
          {isStreaming && (
            <span className="inline-block h-4 w-0.5 bg-emerald-400 animate-pulse ml-0.5 align-middle" />
          )}
        </div>
        <p className="text-[10px] text-zinc-700 mt-1 pl-1">
          {new Date(message.timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  )
}
