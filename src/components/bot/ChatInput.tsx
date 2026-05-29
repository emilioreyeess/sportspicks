"use client"

import { useRef, useState, type KeyboardEvent } from "react"

interface Props {
  onSend: (message: string, image?: File) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({ onSend, disabled, placeholder }: Props) {
  const [text, setText] = useState("")
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImage(file)
    setPreview(URL.createObjectURL(file))
    // Reset so same file can be re-uploaded
    e.target.value = ""
  }

  function clearImage() {
    if (preview) URL.revokeObjectURL(preview)
    setImage(null)
    setPreview(null)
  }

  function handleSend() {
    if (disabled || (!text.trim() && !image)) return
    onSend(text.trim(), image ?? undefined)
    setText("")
    clearImage()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Paste image support
  function handlePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find(
      (i) => i.type.startsWith("image/")
    )
    if (item) {
      const file = item.getAsFile()
      if (file) {
        setImage(file)
        setPreview(URL.createObjectURL(file))
      }
    }
  }

  // Drag & drop
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith("image/")) {
      setImage(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  return (
    <div
      className="rounded-2xl bg-zinc-900/60 border border-white/[0.07] p-3 space-y-2
        focus-within:border-white/[0.14] transition-colors"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Image preview */}
      {preview && (
        <div className="relative w-20 h-20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="preview" className="w-20 h-20 object-cover rounded-xl" />
          <button
            onClick={clearImage}
            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-zinc-700
              text-white text-xs flex items-center justify-center hover:bg-red-600 transition-colors"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Image upload button */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          title="Subir imagen de combinada"
          className="shrink-0 h-9 w-9 rounded-xl bg-zinc-800 hover:bg-zinc-700
            flex items-center justify-center text-zinc-400 hover:text-white
            transition-colors disabled:opacity-40"
        >
          <ImageIcon />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />

        {/* Text area */}
        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
          rows={1}
          placeholder={placeholder ?? "Pega o sube tu combinada, o escribe una pregunta…"}
          className="flex-1 resize-none bg-transparent text-sm text-white placeholder-zinc-600
            outline-none min-h-[36px] max-h-32 leading-relaxed py-1.5 disabled:opacity-50"
          style={{ fieldSizing: "content" } as any}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={disabled || (!text.trim() && !image)}
          className="shrink-0 h-9 w-9 rounded-xl bg-emerald-500 hover:bg-emerald-400
            flex items-center justify-center text-white transition-colors
            disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  )
}

function ImageIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.69l-2.22-2.219a.75.75 0 00-1.06 0l-1.91 1.909.47.47a.75.75 0 11-1.06 1.06L6.53 8.091a.75.75 0 00-1.06 0l-3 2.97v.001z" clipRule="evenodd" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M3.105 2.288a.75.75 0 00-.826.95l1.414 4.926A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.288z" />
    </svg>
  )
}
