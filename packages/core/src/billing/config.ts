// Plus is $12.99/month or $129.99/year, both with a 7-day free trial (foxing/monetization.md). Price IDs come from Worker env; the rest is
// pinned here so paywall copy and the checkout trial never drift.
export const TRIAL_DAYS = 7;

export type BillingPlan = "monthly" | "annual";

/** Display constants for the paywall, in cents to avoid float drift (annual saves ~$26). */
export const PLUS_PRICING = {
  currency: "usd",
  monthlyCents: 1299,
  annualCents: 12999,
  annualSavingsDollars: 26,
} as const;

export type BillingPriceConfig = { monthly: string; annual: string };

export type StripeEnv = {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_MONTHLY?: string;
  STRIPE_PRICE_ANNUAL?: string;
};

/** The Stripe settings when all four are set, else null: Plus cannot be bought yet, so billing routes answer 503 and pages offer no upgrade. */
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
