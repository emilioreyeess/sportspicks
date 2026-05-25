"use client"

import type { WCTeam } from "@/lib/world-cup/types"

interface Props {
  team: WCTeam
  size?: "sm" | "md" | "lg"
  showName?: boolean
  className?: string
}

const SIZE_CONFIG = {
  sm: { flag: "text-base", code: "text-[10px]", name: "text-xs" },
  md: { flag: "text-2xl",  code: "text-xs",    name: "text-sm" },
  lg: { flag: "text-4xl",  code: "text-sm",    name: "text-base" },
} as const

export function TeamCrest({ team, size = "md", showName = true, className = "" }: Props) {
  const cfg = SIZE_CONFIG[size]
  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      <span className={`${cfg.flag} leading-none`} aria-hidden="true">{team.flagEmoji}</span>
      {showName && (
        <div className="min-w-0">
          <p className={`font-black tracking-tight text-white truncate ${cfg.name}`}>{team.shortName}</p>
          <p className={`font-bold uppercase tracking-widest text-zinc-500 truncate ${cfg.code}`}>{team.confederation}</p>
        </div>
      )}
    </div>
  )
}
