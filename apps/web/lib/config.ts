// Single source of truth for all pricing, limits, and business logic
// constants. Import from here. Never hardcode these values anywhere else.
//
// When prices, free-tier limits, or trial durations change, this file is
// the only place to update.

// ─── Pricing ──────────────────────────────────────────────────────────────

export const PLUS_PRICE_MONTHLY = '$12.99'
export const PLUS_PRICE_ANNUAL = '$129.99'
export const PLUS_ANNUAL_SAVINGS = '$26'
export const PLUS_TRIAL_DAYS = 7

// ─── Free tier limits ────────────────────────────────────────────────────
// Free gets ZERO on-demand AI (decision D11); all AI companion features are
// Plus. No free AI allowance constant exists by design.

export const FREE_MAX_CLUBS = 1

// ─── Human-readable labels derived from the above ─────────────────────────

export const PLUS_PRICE_MONTHLY_LABEL = `${PLUS_PRICE_MONTHLY}/month`
export const PLUS_PRICE_ANNUAL_LABEL = `${PLUS_PRICE_ANNUAL}/year`
export const PLUS_ANNUAL_SAVINGS_LABEL = `Save ${PLUS_ANNUAL_SAVINGS}`
export const PLUS_TRIAL_LABEL = `${PLUS_TRIAL_DAYS}-day free trial`

// "$12.99/month or $129.99/year": used in meta descriptions and copy.
export const PLUS_PRICE_COMBINED_LABEL = `${PLUS_PRICE_MONTHLY_LABEL} or ${PLUS_PRICE_ANNUAL_LABEL}`
