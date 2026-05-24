"use client"

/**
 * Renders bot messages with basic markdown:
 * **bold**, *italic*, bullet lists, numbered lists, inline code, horizontal rules.
 * No heavy library dependency.
 */
export function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split("\n")
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} className="border-zinc-700 my-3" />)
      i++
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2]
      const cls = level === 1 ? "text-lg font-bold text-white mt-3 mb-1"
                : level === 2 ? "text-base font-bold text-white mt-2 mb-0.5"
                : "text-sm font-semibold text-zinc-200 mt-1"
      elements.push(<p key={i} className={cls}>{inlineFormat(text)}</p>)
      i++
      continue
    }

    // Bullet list
    if (/^[-*]\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].slice(2))
        i++
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-1 space-y-0.5 pl-4">
          {items.map((it, j) => (
            <li key={j} className="text-sm text-zinc-300 list-disc">{inlineFormat(it)}</li>
          ))}
        </ul>
      )
      continue
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""))
        i++
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-1 space-y-0.5 pl-4">
          {items.map((it, j) => (
            <li key={j} className="text-sm text-zinc-300 list-decimal">{inlineFormat(it)}</li>
          ))}
        </ol>
      )
      continue
    }

    // Empty line → small gap
    if (line.trim() === "") {
      elements.push(<div key={i} className="h-1" />)
      i++
      continue
    }

    // Normal paragraph
    elements.push(
      <p key={i} className="text-sm text-zinc-300 leading-relaxed">
        {inlineFormat(line)}
      </p>
    )
    i++
  }

  return <div className="space-y-0.5">{elements}</div>
}

function inlineFormat(text: string): React.ReactNode {
  // Split on **bold**, *italic*, `code`
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i} className="italic text-zinc-200">{part.slice(1, -1)}</em>
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="bg-zinc-800 text-emerald-400 px-1 py-0.5 rounded text-xs font-mono">
          {part.slice(1, -1)}
        </code>
      )
    }
    return <span key={i}>{part}</span>
  })
}
