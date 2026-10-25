// Billing endpoints. Checkout + portal are user-initiated (auth required; a
// free user may start checkout). Neither writes the tier -- only the Stripe webhook does
// (webhooks-stripe.ts). Stripe is dependency-injected; when unconfigured every call
// throws BillingNotConfiguredError, surfaced here as a clean 503.
import { Hono } from "hono";
import { billing, billingCheckoutInput } from "@foxing/core";
import { errors } from "../error";
import { parseJson, requireSession } from "../http";
import { rateLimit } from "../middleware/rate-limit";
import type { Env } from "../types";

export const billingRoutes = new Hono<Env>();

function unavailableIfUnconfigured(err: unknown): never {
  if (err instanceof billing.BillingNotConfiguredError) {
    throw errors.serviceUnavailable("Billing is not available yet.");
  }
  throw err;
}

billingRoutes.post("/billing/checkout", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const profile = c.get("profile");
  const input = await parseJson(c, billingCheckoutInput);
  const { client, prices } = c.get("billing");
  const origin = new URL(c.req.url).origin;

  try {
    const { url } = await client.createCheckoutSession({
      priceId: billing.priceIdForPlan(input.plan, prices),
      customerEmail: session.email,
      clientReferenceId: session.id,
      existingCustomerId: profile?.stripeCustomerId ?? null,
      successUrl: `${origin}/settings?billing=success`,
      cancelUrl: `${origin}/settings?billing=canceled`,
    });
    return c.json({ url });
  } catch (err) {
    unavailableIfUnconfigured(err);
  }
});

billingRoutes.post("/billing/portal", rateLimit("write"), async (c) => {
  requireSession(c);
  const profile = c.get("profile");
  const { client } = c.get("billing");
  if (!profile?.stripeCustomerId) {
    throw errors.conflict("No billing account yet. Start a subscription first.");
  }
  const origin = new URL(c.req.url).origin;

  try {
    const { url } = await client.createPortalSession({
      customerId: profile.stripeCustomerId,
      returnUrl: `${origin}/settings`,
    });
    return c.json({ url });
  } catch (err) {
    unavailableIfUnconfigured(err);
  }
});
