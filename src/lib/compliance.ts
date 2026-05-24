// Compliance state management — persisted in localStorage

export type ConsentState = {
  age_verified: boolean
  cookies_analytics: boolean
  cookies_marketing: boolean
  cookies_necessary: boolean // always true
  consent_given_at: string | null
  version: number
}

const KEY = "sp_compliance_v1"
const CURRENT_VERSION = 1

export function getConsent(): ConsentState {
  if (typeof window === "undefined") {
    return defaultConsent()
  }
  try {
    const stored = localStorage.getItem(KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as ConsentState
      if (parsed.version === CURRENT_VERSION) return parsed
    }
  } catch {}
  return defaultConsent()
}

export function saveConsent(partial: Partial<ConsentState>): ConsentState {
  const current = getConsent()
  const updated: ConsentState = {
    ...current,
    ...partial,
    version: CURRENT_VERSION,
    consent_given_at: new Date().toISOString(),
  }
  localStorage.setItem(KEY, JSON.stringify(updated))
  return updated
}

export function hasAgeVerified(): boolean {
  return getConsent().age_verified
}

export function hasCookieConsent(): boolean {
  const c = getConsent()
  return c.consent_given_at !== null
}

export function revokeConsent() {
  localStorage.removeItem(KEY)
  if (typeof window !== "undefined") window.location.reload()
}

function defaultConsent(): ConsentState {
  return {
    age_verified: false,
    cookies_analytics: false,
    cookies_marketing: false,
    cookies_necessary: true,
    consent_given_at: null,
    version: CURRENT_VERSION,
  }
}
