import Stripe from "stripe"

if (!process.env.STRIPE_SECRET_KEY) {
  // In build/dev without the key, we still export a stub so TS compiles fine.
  // The actual runtime check happens inside each route handler.
}

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured")
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
      typescript: true,
    })
  }
  return _stripe
}

/** Plan id → Stripe Price id (set in .env.local) */
export const PRICE_IDS: Record<string, string | undefined> = {
  premium:         process.env.STRIPE_PRICE_PREMIUM,          // fallback (monthly)
  pro:             process.env.STRIPE_PRICE_PRO,              // fallback (monthly)
  premium_monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY ?? process.env.STRIPE_PRICE_PREMIUM,
  premium_annual:  process.env.STRIPE_PRICE_PREMIUM_ANNUAL  ?? process.env.STRIPE_PRICE_PREMIUM,
  pro_monthly:     process.env.STRIPE_PRICE_PRO_MONTHLY     ?? process.env.STRIPE_PRICE_PRO,
  pro_annual:      process.env.STRIPE_PRICE_PRO_ANNUAL      ?? process.env.STRIPE_PRICE_PRO,
}
