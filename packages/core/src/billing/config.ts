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

/** The Worker settings billing needs: Stripe's secret key, its webhook secret and the two prices. */
export type StripeEnv = {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_MONTHLY?: string;
  STRIPE_PRICE_ANNUAL?: string;
};

/** The Stripe settings when all four are set, else null: Plus cannot be bought yet, so the
 *  billing routes answer 503 and the pages offer no upgrade (CLAUDE.md rule 6). */
export function stripeSettings(env: StripeEnv): {
  secretKey: string;
  webhookSecret: string;
  prices: BillingPriceConfig;
} | null {
  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_ANNUAL } =
    env;
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !STRIPE_PRICE_MONTHLY || !STRIPE_PRICE_ANNUAL)
    return null;
  return {
    secretKey: STRIPE_SECRET_KEY,
    webhookSecret: STRIPE_WEBHOOK_SECRET,
    prices: { monthly: STRIPE_PRICE_MONTHLY, annual: STRIPE_PRICE_ANNUAL },
  };
}

export function priceIdForPlan(plan: BillingPlan, prices: BillingPriceConfig): string {
  return plan === "annual" ? prices.annual : prices.monthly;
}
