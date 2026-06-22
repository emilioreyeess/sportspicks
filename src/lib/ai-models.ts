/**
 * Enrutamiento explícito de modelos Claude (FASE 2 — control de costes).
 *
 * REGLA: Sonnet SOLO para el motor central que genera el ANÁLISIS FINAL DEL PICK
 * (el bot de IA que razona la recomendación). Todo lo demás —parseo, OCR de
 * boletos, extracción, formateos, settling/arbitraje, explicaciones de stats— va
 * a Haiku. No se quema Sonnet en tareas de enrutamiento ni auxiliares.
 */

// NOTA: los alias `claude-3-5-*-latest` apuntaban a familias YA RETIRADAS
// (Sonnet 3.5 retirado 2025-10-28, Haiku 3.5 retirado 2026-02-19) → la API
// devolvía 404 "model not found". Fijamos los modelos vigentes equivalentes,
// preservando el reparto de tiers (Haiku para auxiliar, Sonnet para el pick).

/** Tareas generales: parseo, OCR, extracción, formateo, settling, stats. */
export const MODEL_HAIKU = "claude-haiku-4-5-20251001"

/** ÚNICA Y EXCLUSIVAMENTE el motor central de análisis del pick (bot IA). */
export const MODEL_SONNET = "claude-sonnet-4-6"
