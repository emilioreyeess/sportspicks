/**
 * Enrutamiento explícito de modelos Claude (FASE 2 — control de costes).
 *
 * REGLA: Sonnet SOLO para el motor central que genera el ANÁLISIS FINAL DEL PICK
 * (el bot de IA que razona la recomendación). Todo lo demás —parseo, OCR de
 * boletos, extracción, formateos, settling/arbitraje, explicaciones de stats— va
 * a Haiku. No se quema Sonnet en tareas de enrutamiento ni auxiliares.
 */

/** Tareas generales: parseo, OCR, extracción, formateo, settling, stats. */
export const MODEL_HAIKU = "claude-3-5-haiku-latest"

/** ÚNICA Y EXCLUSIVAMENTE el motor central de análisis del pick (bot IA). */
export const MODEL_SONNET = "claude-3-5-sonnet-latest"
