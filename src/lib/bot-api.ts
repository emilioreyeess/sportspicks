export interface BotMessage {
  id: string
  role: "user" | "assistant"
  content: string
  imageUrl?: string
  timestamp: Date
}

export interface HistoryEntry {
  role: "user" | "assistant"
  content: string
}

/**
 * Stream a chat message via the Next.js /api/bot route (calls Anthropic directly).
 * Passes conversation history so the model has context.
 */
export async function streamChat(opts: {
  message: string
  image?: File
  history: HistoryEntry[]
  onToken: (text: string) => void
  onDone: () => void
  onError: (err: string) => void
}): Promise<void> {
  const form = new FormData()
  if (opts.message) form.append("message", opts.message)
  if (opts.image) form.append("image", opts.image)
  form.append("history", JSON.stringify(opts.history))

  let res: Response
  try {
    res = await fetch("/api/bot", { method: "POST", body: form })
  } catch {
    opts.onError("No se pudo conectar con el servidor. Recarga la página.")
    return
  }

  if (!res.ok) {
    const text = await res.text().catch(() => `${res.status}`)
    opts.onError(`Error ${res.status}: ${text}`)
    return
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const payload = line.slice(6).trim()
      if (payload === "[DONE]") {
        opts.onDone()
        return
      }
      try {
        const json = JSON.parse(payload)
        if (json.text !== undefined) {
          opts.onToken(json.text)
        }
      } catch {
        // ignore malformed chunks
      }
    }
  }
  opts.onDone()
}
