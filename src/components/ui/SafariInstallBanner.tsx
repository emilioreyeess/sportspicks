"use client"

import { useEffect, useState } from "react"

/**
 * Banner móvil iOS:
 *  - En Safari proper → instrucciones para "Añadir a pantalla de inicio"
 *  - En WebView (WhatsApp, Instagram, Telegram, Facebook, etc.) → instrucciones
 *    para abrir en Safari (porque desde el WebView NO se puede añadir).
 *
 * Persistencia: se descarta por sesión + se guarda dismiss con caducidad de 14 días
 * (para no quedarse bloqueado para siempre si el usuario tocó "Cerrar" sin querer).
 */

const STORAGE_KEY = "sp_install_dismissed_at"
const DISMISS_DAYS = 14

type Context = "safari" | "webview" | "android" | "desktop" | "standalone"

function detectContext(): Context {
  if (typeof navigator === "undefined" || typeof window === "undefined") return "desktop"

  // Ya está instalada como PWA
  if ((window.navigator as any).standalone === true) return "standalone"
  if (window.matchMedia("(display-mode: standalone)").matches) return "standalone"

  const ua = navigator.userAgent
  const isIos = /iphone|ipad|ipod/i.test(ua)
  if (!isIos) {
    return /android/i.test(ua) ? "android" : "desktop"
  }

  // iOS WebViews (apps embebidas)
  const isWebView =
    /fban|fbav|fbios/i.test(ua) ||           // Facebook
    /instagram/i.test(ua) ||                   // Instagram
    /line/i.test(ua) ||                        // LINE
    /micromessenger/i.test(ua) ||              // WeChat
    /(twitter|twitterandroid)/i.test(ua) ||    // Twitter
    /tiktok/i.test(ua) ||                      // TikTok
    /(snapchat)/i.test(ua) ||                  // Snapchat
    /telegram/i.test(ua) ||                    // Telegram
    /whatsapp/i.test(ua) ||                    // WhatsApp (rara vez declarado, pero por si acaso)
    // Heurística general: en iOS, los WebViews suelen NO incluir "Version/X.X" que Safari sí
    (isIos && !/version\/\d+/i.test(ua))

  if (isWebView) return "webview"

  // Safari proper en iOS — descarta otros navegadores
  const otherBrowser = /crios|fxios|edgios|opios|duckduck/i.test(ua)
  if (otherBrowser) return "desktop" // tratamos otros navegadores móviles como "no se puede"

  return "safari"
}

function isDismissed(): boolean {
  if (typeof window === "undefined") return false
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const at = parseInt(raw, 10)
    if (!Number.isFinite(at)) return false
    const ageMs = Date.now() - at
    return ageMs < DISMISS_DAYS * 86_400_000
  } catch { return false }
}

export function SafariInstallBanner() {
  const [ctx, setCtx] = useState<Context | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const c = detectContext()
    setCtx(c)

    // No mostrar nunca si ya está instalada, en desktop o si fue descartada recientemente
    if (c === "standalone" || c === "desktop" || c === "android") return
    if (isDismissed()) return

    const t = setTimeout(() => setShow(true), 1200)
    return () => clearTimeout(t)
  }, [])

  function dismiss() {
    setShow(false)
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())) } catch {}
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      // Aviso visual mínimo
      const btn = document.getElementById("sp-copy-url-btn")
      if (btn) {
        const orig = btn.textContent
        btn.textContent = "✓ URL copiada — pégala en Safari"
        setTimeout(() => { if (btn) btn.textContent = orig ?? "" }, 2500)
      }
    } catch { /* fallback silencioso */ }
  }

  if (!show || !ctx) return null

  // ── WebView: explicar que hay que abrir en Safari ────────────────────────
  if (ctx === "webview") {
    return (
      <div className="fixed bottom-20 inset-x-3 z-50 animate-slide-up">
        <div className="relative rounded-2xl border border-amber-700/60 bg-zinc-900/95 backdrop-blur-md shadow-2xl p-4">
          <button onClick={dismiss} aria-label="Cerrar"
            className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold">
            ✕
          </button>

          <div className="flex items-center gap-3 mb-3 pr-6">
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-700/50 flex items-center justify-center shrink-0 text-2xl">
              ⚠️
            </div>
            <div>
              <p className="text-sm font-black text-white leading-tight">Abre SportsPicks en Safari</p>
              <p className="text-xs text-zinc-400 leading-snug">Para instalarla y pagar, sal del navegador interno</p>
            </div>
          </div>

          <ol className="space-y-2 mb-4 text-sm text-zinc-300">
            <Step n={1}>
              Pulsa el botón <strong className="text-white">«…»</strong> (esquina superior derecha)
            </Step>
            <Step n={2}>
              Toca <strong className="text-white">«Abrir en Safari»</strong> o <strong className="text-white">«Abrir en navegador»</strong>
            </Step>
            <Step n={3}>
              Una vez en Safari verás el botón para añadir a la pantalla de inicio
            </Step>
          </ol>

          <button
            id="sp-copy-url-btn"
            onClick={copyUrl}
            className="w-full py-2.5 rounded-xl bg-zinc-800 text-sm text-zinc-200 font-semibold border border-zinc-700 active:scale-[0.98] transition-all"
          >
            📋 Copiar URL para abrir en Safari
          </button>
        </div>
      </div>
    )
  }

  // ── Safari proper: instrucciones de "Añadir a pantalla de inicio" ──────
  return (
    <div className="fixed bottom-20 inset-x-3 z-50 animate-slide-up">
      <div className="relative rounded-2xl border border-zinc-700/80 bg-zinc-900/95 backdrop-blur-md shadow-2xl p-4">
        <button onClick={dismiss} aria-label="Cerrar"
          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold">
          ✕
        </button>

        <div className="flex items-center gap-3 mb-3 pr-6">
          <div className="w-11 h-11 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 overflow-hidden">
            <img src="/icon.svg" alt="SportsPicks" className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-black text-white leading-tight">Añade SportsPicks</p>
            <p className="text-xs text-zinc-400 leading-snug">a tu pantalla de inicio para acceso rápido</p>
          </div>
        </div>

        <ol className="space-y-2.5 mb-4">
          <Step n={1}>
            Pulsa el botón <ShareIcon /> en la barra de Safari
          </Step>
          <Step n={2}>
            Desplázate y toca <strong className="text-white font-bold">«Añadir a pantalla de inicio»</strong>
          </Step>
          <Step n={3}>
            Toca <strong className="text-white font-bold">«Añadir»</strong> y listo
          </Step>
        </ol>

        <button onClick={dismiss}
          className="w-full py-2.5 rounded-xl bg-zinc-800 text-sm text-zinc-300 font-semibold border border-zinc-700 active:scale-[0.98] transition-all">
          Ya lo tengo instalado
        </button>
      </div>

      <div className="flex justify-center mt-1.5">
        <svg width="18" height="10" viewBox="0 0 18 10" fill="none" className="text-zinc-700">
          <path d="M9 10L0 0h18L9 10z" fill="currentColor" />
        </svg>
      </div>
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-700/60 text-emerald-400 text-[10px] font-black flex items-center justify-center mt-0.5">
        {n}
      </span>
      <p className="text-sm text-zinc-300 leading-snug">{children}</p>
    </li>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round"
      className="inline w-4 h-4 text-blue-400 mx-0.5 align-[-2px]">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}
