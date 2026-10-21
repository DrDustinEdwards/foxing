// Billing config. Pricing is authoritative from foxing/monetization.md:
// Plus is $12.99/month or $129.99/year, both with a 7-day free trial. Price IDs come
// from Worker env (set once the Stripe products exist); everything else is pinned here
// so the paywall copy and the checkout trial never drift from the spec.
export const TRIAL_DAYS = 7;

export type BillingPlan = "monthly" | "annual";

/** Display constants for the paywall (cents to avoid float drift). Annual saves ~$26
 *  versus paying monthly for a year ($155.88 - $129.99), the "Save $26" toggle label. */
export const PLUS_PRICING = {
  currency: "usd",
  monthlyCents: 1299,
  annualCents: 12999,
  annualSavingsDollars: 26,
} as const;

/** The two Stripe price IDs, read from Worker env (STRIPE_PRICE_MONTHLY/_ANNUAL). */
export type BillingPriceConfig = { monthly: string; annual: string };

export function priceIdForPlan(plan: BillingPlan, prices: BillingPriceConfig): string {
  return plan === "annual" ? prices.annual : prices.monthly;
}
