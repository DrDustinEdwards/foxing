// The one file that touches the Stripe SDK. API routes depend on the BillingClient
// interface (dependency-injected, same pattern as CompanionCaller): the Worker builds
// the real Stripe-backed client from its secrets; tests inject a stub with no network
// call and no key. Configured for Workers (fetch HTTP client + SubtleCrypto webhook
// verification, since Workers has no synchronous crypto).
import Stripe from "stripe";
import { TRIAL_DAYS } from "./config";

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
}

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

export function createStripeBilling(config: StripeBillingConfig): BillingClient {
  const stripe = new Stripe(config.secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
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
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      return {
        status: sub.status,
        currentPeriodEnd: readPeriodEnd(sub),
        customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      };
    },
  };
}
