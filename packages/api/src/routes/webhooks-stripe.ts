// Stripe webhook. This is the SINGLE writer of profiles.subscription_tier.
// Signature-verified (no session; Stripe posts with no cookie) and idempotent (every
// event id recorded once; a retry is a no-op). Emits nothing to the activity feed --
// billing is private. Mounted inside the normal pipeline: session/profile resolve to
// null harmlessly, and it is deliberately NOT rate-limited (Stripe retries).
import { Hono } from "hono";
import {
  type BillingClient,
  type BillingIntent,
  billing,
  billingRepo,
  profilesRepo,
} from "@foxing/core";
import type { Db } from "@foxing/core";
import { errors } from "../error";
import type { Env } from "../types";

export const stripeWebhookRoutes = new Hono<Env>();

/** Stripe sends period ends as UNIX seconds; the profile stores ms Date. */
function toDate(unixSeconds: number | null): Date | null {
  return unixSeconds ? new Date(unixSeconds * 1000) : null;
}

async function applyIntent(db: Db, client: BillingClient, intent: BillingIntent): Promise<void> {
  switch (intent.op) {
    case "link": {
      await profilesRepo.setStripeCustomerId(db, intent.userId, intent.customerId);
      if (intent.subscriptionId) {
        const sub = await client.getSubscription(intent.subscriptionId);
        await profilesRepo.setSubscriptionState(db, intent.userId, {
          tier: billing.tierForStatus(sub.status),
          status: sub.status,
          periodEnd: toDate(sub.currentPeriodEnd),
        });
      }
      return;
    }
    case "sync": {
      const profile = await profilesRepo.getProfileByStripeCustomerId(db, intent.customerId);
      // Not linked yet (subscription event raced ahead of checkout.completed); the link
      // event will set the correct state. Skip rather than guess.
      if (!profile) return;
      await profilesRepo.setSubscriptionState(db, profile.id, {
        tier: intent.tier,
        status: intent.status,
        periodEnd: toDate(intent.periodEnd),
      });
      return;
    }
    case "status": {
      const profile = await profilesRepo.getProfileByStripeCustomerId(db, intent.customerId);
      if (!profile) return;
      await profilesRepo.setSubscriptionStatus(db, profile.id, intent.status);
      return;
    }
    case "ignore":
      return;
  }
}

stripeWebhookRoutes.post("/webhooks/stripe", async (c) => {
  const signature = c.req.header("stripe-signature");
  if (!signature) throw errors.validation({ signature: "missing stripe-signature header" });

  const payload = await c.req.text();
  const { client } = c.get("billing");
  const db = c.get("db");

  let event: Awaited<ReturnType<BillingClient["verifyWebhook"]>>;
  try {
    event = await client.verifyWebhook(payload, signature);
  } catch (err) {
    if (err instanceof billing.BillingNotConfiguredError) {
      throw errors.serviceUnavailable("Billing is not available yet.");
    }
    throw errors.forbidden("Invalid signature.");
  }

  // Idempotency guard: a duplicate delivery records nothing and is acked without effect.
  const fresh = await billingRepo.recordEventOnce(db, event.id, event.type);
  if (!fresh) return c.json({ received: true, duplicate: true });

  try {
    await applyIntent(db, client, billing.interpretStripeEvent(event));
  } catch (err) {
    // Without this the retry would be a duplicate and the tier would never change
    // (Grok audit 2026-10-21, FX-9). The thrown error is the 500 Stripe retries on.
    await billingRepo.forgetEvent(db, event.id);
    throw err;
  }
  return c.json({ received: true });
});
