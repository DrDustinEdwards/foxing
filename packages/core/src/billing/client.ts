// The one file that touches the Stripe SDK. API routes depend on the BillingClient
// interface (dependency-injected, same pattern as CompanionCaller): the Worker builds
// the real Stripe-backed client from its secrets; tests inject a stub with no network
// call and no key. Configured for Workers (fetch HTTP client + SubtleCrypto webhook
// verification, since Workers has no synchronous crypto).
import Stripe from "stripe";
import { TRIAL_DAYS } from "./config";
import { pickCurrentSubscription } from "./webhook";

export type BillingCheckoutArgs = {
  priceId: string;
  customerEmail: string;
  /** The Foxing user id; surfaces on checkout.session.completed to link user<->customer. */
  clientReferenceId: string;
  existingCustomerId: string | null;
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

/** The Stripe API version every request is made with. Pinned, so an SDK upgrade never changes
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

/** Reads current_period_end without depending on a specific Stripe apiVersion, where the
 *  field has moved between the subscription and its items across versions. */
function readPeriodEnd(sub: Stripe.Subscription): number | null {
  const top = (sub as unknown as { current_period_end?: number }).current_period_end;
  if (typeof top === "number") return top;
  const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  return typeof item?.current_period_end === "number" ? item.current_period_end : null;
}

function lite(sub: Stripe.Subscription): BillingSubscriptionLite {
  return {
    status: sub.status,
    currentPeriodEnd: readPeriodEnd(sub),
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
  };
}

export function createStripeBilling(config: StripeBillingConfig): BillingClient {
  const stripe = new Stripe(config.secretKey, {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
    // Two automatic retries with backoff (the SDK adds idempotency keys where safe), and a
    // timeout well under a Worker request's budget (SDK defaults: 1 retry, 80 s).
    maxNetworkRetries: 2,
    timeout: 20_000,
    appInfo: { name: "Foxing" },
  });
  const cryptoProvider = Stripe.createSubtleCryptoProvider();

  return {
    async createCheckoutSession(a) {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: a.priceId, quantity: 1 }],
        subscription_data: { trial_period_days: TRIAL_DAYS },
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
      const session = await stripe.billingPortal.sessions.create({
        customer: a.customerId,
        return_url: a.returnUrl,
      });
      return { url: session.url };
    },

    async verifyWebhook(payload, signature) {
      const event = await stripe.webhooks.constructEventAsync(
        payload,
        signature,
        config.webhookSecret,
        undefined,
        cryptoProvider,
      );
      return {
        id: event.id,
        type: event.type,
        object: event.data.object as unknown as Record<string, unknown>,
      };
    },

    async getSubscription(subscriptionId) {
      return lite(await stripe.subscriptions.retrieve(subscriptionId));
    },

    async getCurrentSubscription(customerId) {
      // Newest first. Resolving by customer, not by the event's subscription, keeps a late
      // event for an old subscription from downgrading someone who has since resubscribed.
      const { data } = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
      });
      const current = pickCurrentSubscription(data);
      return current ? lite(current) : null;
    },
  };
}
