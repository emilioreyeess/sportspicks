/**
 * llmCache — caché de respuestas del LLM con TTL de 24h.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Backend-only (service_role). Reduce gasto de tokens cacheando respuestas
 * por hash SHA-256 del prompt. Degrada con gracia: si la BD falla, devuelve
 * miss y deja que el caller llame al LLM normalmente — nunca lanza por caché.
 *
 * Uso típico:
 *
 *   const cached = await getCachedLlmResponse(prompt)
 *   if (cached) return cached
 *   const fresh = await callTheLlm(prompt)
 *   await setCachedLlmResponse(prompt, fresh)
 *   return fresh
 *
 * O en un solo paso con la firma de conveniencia:
 *
 *   const answer = await withLlmCache(prompt, () => callTheLlm(prompt))
 */

import { createHash } from "crypto"
import { createServiceClient } from "@/lib/supabase/client"

/** TTL de la caché: 24 horas en milisegundos. */
const LLM_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** Hash determinista del prompt → clave primaria de `llm_cache`. */
export function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt, "utf8").digest("hex")
}

/**
 * Busca una respuesta cacheada vigente (< 24h) para el prompt dado.
 * @returns la respuesta cacheada, o `null` si no existe o ha expirado.
 */
export async function getCachedLlmResponse(prompt: string): Promise<string | null> {
  const promptHash = hashPrompt(prompt)
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from("llm_cache")
      .select("response, created_at")
      .eq("prompt_hash", promptHash)
      .maybeSingle()

    if (error || !data) return null

    const age = Date.now() - new Date(data.created_at as string).getTime()
    if (age > LLM_CACHE_TTL_MS) return null   // expirada → miss

    return data.response as string
  } catch {
    // Degradación: cualquier fallo de caché = miss, nunca rompe el flujo del LLM.
    return null
  }
}

/**
 * Persiste (o refresca) la respuesta del LLM para el prompt dado.
 * Upsert sobre `prompt_hash`: una nueva escritura renueva `created_at` y por
 * tanto el TTL. No lanza si la BD falla — la caché es best-effort.
 */
export async function setCachedLlmResponse(prompt: string, response: string): Promise<void> {
  const promptHash = hashPrompt(prompt)
  try {
    const sb = createServiceClient()
    await sb
      .from("llm_cache")
      .upsert(
        { prompt_hash: promptHash, response, created_at: new Date().toISOString() },
        { onConflict: "prompt_hash" },
      )
  } catch {
    // best-effort — un fallo al cachear no debe afectar a la respuesta ya obtenida.
  }
}

/**
 * Firma de conveniencia: resuelve un prompt usando caché read-through.
 * Si hay hit vigente lo devuelve; si no, invoca `generate()`, cachea y devuelve.
 *
 * @param prompt    Texto del prompt (también es la clave de caché vía hash).
 * @param generate  Callback que llama realmente al LLM cuando hay miss.
 */
export async function withLlmCache(
  prompt: string,
  generate: () => Promise<string>,
): Promise<string> {
  const cached = await getCachedLlmResponse(prompt)
  if (cached !== null) return cached

  const fresh = await generate()
  await setCachedLlmResponse(prompt, fresh)
  return fresh
}
