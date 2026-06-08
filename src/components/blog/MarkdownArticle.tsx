/**
 * MarkdownArticle — renderer Markdown mínimo, SIN dependencias externas.
 *
 * Soporta exactamente los constructos del artículo importado: h2/h3, párrafos,
 * imágenes, blockquote, listas (ul/ol), tablas GFM e inline (**negrita**,
 * *cursiva*, [enlace](url)). Server Component puro (0 JS cliente).
 *
 * No pretende ser un parser Markdown completo — es deliberadamente acotado al
 * subconjunto que usamos, para no añadir librerías.
 */

import type { ReactNode } from "react"

// ── Inline: **negrita**, *cursiva*, [texto](url) ───────────────────────────────
function renderInline(text: string, kp: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([^\]]+)\]\(([^)]+)\))/g
  let last = 0, k = 0, m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[1]) {
      nodes.push(<strong key={`${kp}-b${k++}`} className="font-semibold text-zinc-200">{m[2]}</strong>)
    } else if (m[3]) {
      nodes.push(<em key={`${kp}-i${k++}`}>{m[4]}</em>)
    } else if (m[5]) {
      const url = m[7]
      const external = /^https?:\/\//.test(url)
      nodes.push(
        <a key={`${kp}-a${k++}`} href={url}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300">
          {m[6]}
        </a>,
      )
    }
    last = re.lastIndex
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

const IMG_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/
const cells = (row: string) => row.split("|").slice(1, -1).map((c) => c.trim())

export function MarkdownArticle({ content }: { content: string }) {
  const lines = content.split("\n")
  const out: ReactNode[] = []
  let i = 0, key = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Vacío
    if (!trimmed) { i++; continue }

    // Imagen (línea propia)
    const img = trimmed.match(IMG_RE)
    if (img) {
      out.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img key={key++} src={img[2]} alt={img[1]} loading="lazy"
          className="my-6 w-full rounded-2xl border border-white/[0.06] bg-zinc-900" />,
      )
      i++; continue
    }

    // Encabezados
    if (trimmed.startsWith("### ")) {
      out.push(<h3 key={key++} className="text-[16px] sm:text-[18px] font-bold text-zinc-200 tracking-tight mt-8 mb-3">{renderInline(trimmed.slice(4), `h3${key}`)}</h3>)
      i++; continue
    }
    if (trimmed.startsWith("## ")) {
      out.push(<h2 key={key++} className="text-[20px] sm:text-[24px] font-black text-white tracking-tight leading-tight mt-12 mb-4">{renderInline(trimmed.slice(3), `h2${key}`)}</h2>)
      i++; continue
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      out.push(<blockquote key={key++} className="my-6 border-l-2 border-emerald-700/50 pl-4 text-[15px] italic text-zinc-400">{renderInline(trimmed.slice(2), `bq${key}`)}</blockquote>)
      i++; continue
    }

    // Tabla GFM (líneas consecutivas que empiezan por |)
    if (trimmed.startsWith("|")) {
      const rows: string[] = []
      while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(lines[i].trim()); i++ }
      const header = cells(rows[0])
      const body = rows.slice(2) // rows[1] es el separador |---|
      out.push(
        <div key={key++} className="my-6 overflow-x-auto rounded-2xl border border-white/[0.06]">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-zinc-900 border-b border-white/[0.08]">
                {header.map((h, j) => (
                  <th key={j} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-400">{renderInline(h, `th${key}-${j}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri} className={`border-b border-white/[0.04] ${ri % 2 ? "bg-white/[0.015]" : ""}`}>
                  {cells(r).map((c, ci) => (
                    <td key={ci} className="px-3 py-2.5 text-zinc-400 align-top">{renderInline(c, `td${key}-${ri}-${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    // Lista desordenada
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-*]\s+/, "")); i++ }
      out.push(
        <ul key={key++} className="my-4 space-y-2 pl-5 list-disc marker:text-emerald-500/60">
          {items.map((it, j) => <li key={j} className="text-[15px] text-zinc-400 leading-relaxed">{renderInline(it, `li${key}-${j}`)}</li>)}
        </ul>,
      )
      continue
    }

    // Lista ordenada
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+\.\s+/, "")); i++ }
      out.push(
        <ol key={key++} className="my-4 space-y-2 pl-5 list-decimal marker:text-emerald-500/60 marker:font-bold">
          {items.map((it, j) => <li key={j} className="text-[15px] text-zinc-400 leading-relaxed pl-1">{renderInline(it, `ol${key}-${j}`)}</li>)}
        </ol>,
      )
      continue
    }

    // Párrafo
    out.push(<p key={key++} className="my-4 text-[15px] text-zinc-400 leading-[1.75]">{renderInline(trimmed, `p${key}`)}</p>)
    i++
  }

  return <>{out}</>
}
