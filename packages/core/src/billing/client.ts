// The one file that talks to Stripe, with fetch and SubtleCrypto: the SDK's resource classes were 238 KB of the
// Worker for four calls. API routes depend on the BillingClient interface (dependency-injected, same pattern as
// CompanionCaller): the Worker builds the real client from its secrets; tests inject a stub with no network call.
import { hmacSha256Hex } from "@dustinedwards/site-runtime/encoding";
import { safeEqual } from "@dustinedwards/site-runtime/compare";
import { TRIAL_DAYS } from "./config";
import { pickCurrentSubscription } from "./webhook";

export type BillingCheckoutArgs = {
  priceId: string;
  customerEmail: string;
  /** The Foxing user id; surfaces on checkout.session.completed to link user<->customer. */
  clientReferenceId: string;
  existingCustomerId: string | null;
  /** The free trial applies only to a reader who has never subscribed. */
  trial: boolean;
  successUrl: string;
  cancelUrl: string;
};

export type BillingPortalArgs = { customerId: string; returnUrl: string };

/** A verified Stripe event, narrowed to the plain fields the pure interpreter reads. */
export type BillingEventLite = { id: string; type: string; object: Record<string, unknown> };

export type BillingSubscriptionLite = {
  status: string;
  currentPeriodEnd: number | null;
  customerId: string;
};

export interface BillingClient {
  createCheckoutSession(args: BillingCheckoutArgs): Promise<{ url: string }>;
  createPortalSession(args: BillingPortalArgs): Promise<{ url: string }>;
  verifyWebhook(payload: string, signature: string): Promise<BillingEventLite>;
  getSubscription(subscriptionId: string): Promise<BillingSubscriptionLite>;
  /** The customer's current subscription (newest live one, else newest), or null when none. */
  getCurrentSubscription(customerId: string): Promise<BillingSubscriptionLite | null>;
}

/** The Stripe API version every request is made with. Pinned, so Stripe never changes
 *  it silently (https://docs.stripe.com/sdks/set-version). Foxhound pins the same version.
 *  The webhook endpoint in the Stripe Dashboard must use this version too, since an
 *  endpoint's version decides the shape of the events it receives
 *  (https://docs.stripe.com/webhooks/versioning). */
export const STRIPE_API_VERSION = "2026-10-28.endive";

export type StripeBillingConfig = { secretKey: string; webhookSecret: string };

/** Thrown by the not-configured stub so the API can answer 503 rather than a raw 500,
 *  until the Stripe secrets/price ids are set as Worker secrets. */
export class BillingNotConfiguredError extends Error {
  constructor() {
    super("Billing is not configured (Stripe secrets / price ids are unset).");
    this.name = "BillingNotConfiguredError";
  }
}

/** Stand-in client used when Stripe secrets are absent: every method throws. Mirrors the
 *  companion's missing-key path so the whole app still builds, tests, and deploys. */
export function notConfiguredBilling(): BillingClient {
  const fail = (): never => {
    throw new BillingNotConfiguredError();
  };
  return {
    createCheckoutSession: fail,
    createPortalSession: fail,
    verifyWebhook: fail,
    getSubscription: fail,
    getCurrentSubscription: fail,
  };
}

type StripeSubscription = {
  status: string;
  customer: string | { id: string };
  current_period_end?: number;
  items?: { data?: { current_period_end?: number }[] };
};

function lite(sub: StripeSubscription): BillingSubscriptionLite {
  const end = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  return {
    status: sub.status,
    currentPeriodEnd: typeof end === "number" ? end : null,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
  };
}

const WEBHOOK_TOLERANCE_SECONDS = 300;

function formFields(value: unknown, key: string, out: URLSearchParams) {
  if (value === undefined) return;
  if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) formFields(v, `${key}[${k}]`, out);
  } else out.append(key, String(value));
}

export function createStripeBilling(config: StripeBillingConfig): BillingClient {
  async function call<T>(method: "GET" | "POST", path: string, params: Record<string, unknown>): Promise<T> {
    const fields = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) formFields(v, k, fields);
    const init = {
      method,
      headers: { authorization: `Bearer ${config.secretKey}`, "stripe-version": STRIPE_API_VERSION },
      signal: AbortSignal.timeout(20_000),
    };
    const res =
      method === "GET"
        ? await fetch(`https://api.stripe.com/v1/${path}?${fields}`, init)
        : await fetch(`https://api.stripe.com/v1/${path}`, { ...init, body: fields });
    if (!res.ok) throw new Error(`Stripe ${method} ${path} answered ${res.status}.`);
    return (await res.json()) as T;
  }

  return {
    async createCheckoutSession(a) {
      const session = await call<{ url?: string }>("POST", "checkout/sessions", {
        mode: "subscription",
        line_items: [{ price: a.priceId, quantity: 1 }],
        ...(a.trial ? { subscription_data: { trial_period_days: TRIAL_DAYS } } : {}),
        client_reference_id: a.clientReferenceId,
        ...(a.existingCustomerId
          ? { customer: a.existingCustomerId }
          : { customer_email: a.customerEmail }),
        success_url: a.successUrl,
        cancel_url: a.cancelUrl,
      });
      if (!session.url) throw new Error("Stripe did not return a checkout URL.");
      return { url: session.url };
    },

    async createPortalSession(a) {
      const session = await call<{ url: string }>("POST", "billing_portal/sessions", {
        customer: a.customerId,
        return_url: a.returnUrl,
      });
      return { url: session.url };
    },

    // Stripe-Signature: t=<seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">, one v1 per secret in rotation.
    async verifyWebhook(payload, signature) {
      const parts = signature.split(",").map((p) => p.split("=") as [string, string]);
      const t = parts.find(([k]) => k === "t")?.[1] ?? "";
      const expected = await hmacSha256Hex(config.webhookSecret, `${t}.${payload}`);
      let ok = false;
      for (const [k, v] of parts) if (k === "v1" && (await safeEqual(v, expected))) ok = true;
      if (!ok || Math.abs(Date.now() / 1000 - Number(t)) > WEBHOOK_TOLERANCE_SECONDS)
        throw new Error("Stripe webhook signature is not valid.");
      const event = JSON.parse(payload) as { id: string; type: string; data: { object: Record<string, unknown> } };
      return { id: event.id, type: event.type, object: event.data.object };
    },

    async getSubscription(subscriptionId) {
      return lite(await call<StripeSubscription>("GET", `subscriptions/${encodeURIComponent(subscriptionId)}`, {}));
    },

    async getCurrentSubscription(customerId) {
      // Newest first. Resolving by customer, not by the event's subscription, keeps a late
      // event for an old subscription from downgrading someone who has since resubscribed.
      const { data } = await call<{ data: StripeSubscription[] }>("GET", "subscriptions", {
        customer: customerId,
        status: "all",
        limit: 10,
      });
      const current = pickCurrentSubscription(data);
      return current ? lite(current) : null;
    },
  };
}
