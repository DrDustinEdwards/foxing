import { env } from "cloudflare:test";
import { createApi } from "@foxing/api";
import { type BillingClient, createDb, schema } from "@foxing/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

// Stub Stripe: no network, no keys. verifyWebhook returns whatever event the test
// supplies; getSubscription reports an active trial so a checkout.completed link flips
// the user to plus. This is the seam the Worker fills with the real client in prod.
type BillingEventLite = Awaited<ReturnType<BillingClient["verifyWebhook"]>>;

function stubBilling(event?: BillingEventLite): { client: BillingClient; prices: { monthly: string; annual: string } } {
  return {
    prices: { monthly: "price_monthly", annual: "price_annual" },
    client: {
      async createCheckoutSession() {
        return { url: "https://stub.stripe/checkout" };
      },
      async createPortalSession() {
        return { url: "https://stub.stripe/portal" };
      },
      async verifyWebhook() {
        if (!event) throw new Error("no event configured");
        return event;
      },
      async getSubscription() {
        return { status: "active", currentPeriodEnd: 1780000000, customerId: "cus_1" };
      },
    },
  };
}

function apiWith(billing: ReturnType<typeof stubBilling>) {
  return createApi({
    resolveSession: async (req) => {
      const id = req.headers.get("x-test-user");
      return id ? { id, email: `${id}@example.com` } : null;
    },
    resolveCompanionCaller: () =>
      // biome-ignore lint/correctness/useYield: throws on first iteration by design, never yields
      async function* unused() {
        throw new Error("not used in this suite");
      },
    resolveBilling: () => billing,
  });
}

async function seedProfile(id: string, values: Partial<typeof schema.profiles.$inferInsert> = {}) {
  const db = createDb(env.DB);
  await db.insert(schema.user).values({
    id,
    name: "Test",
    email: `${id}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(schema.profiles).values({
    id,
    username: id,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...values,
  });
}

async function tierOf(id: string): Promise<string> {
  const db = createDb(env.DB);
  const rows = await db.select().from(schema.profiles).where(eq(schema.profiles.id, id));
  return rows[0]?.subscriptionTier ?? "missing";
}

describe("billing API (web -> api -> core -> D1)", () => {
  beforeEach(async () => {
    const db = createDb(env.DB);
    await db.delete(schema.billingEvents);
    await db.delete(schema.profiles);
    await db.delete(schema.user);
  });

  it("checkout returns a Stripe URL for a signed-in user", async () => {
    await seedProfile("u_checkout");
    const api = apiWith(stubBilling());
    const res = await api.fetch(
      new Request("https://test.local/billing/checkout", {
        method: "POST",
        headers: { "x-test-user": "u_checkout", "content-type": "application/json" },
        body: JSON.stringify({ plan: "annual" }),
      }),
      env as never,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string };
    expect(body.url).toBe("https://stub.stripe/checkout");
  });

  it("checkout requires a session", async () => {
    const api = apiWith(stubBilling());
    const res = await api.fetch(
      new Request("https://test.local/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "monthly" }),
      }),
      env as never,
    );
    expect(res.status).toBe(401);
  });

  it("a checkout.session.completed webhook flips the tier to plus in D1", async () => {
    await seedProfile("u_web", { subscriptionTier: "free" });
    const event: BillingEventLite = {
      id: "evt_link_1",
      type: "checkout.session.completed",
      object: { client_reference_id: "u_web", customer: "cus_1", subscription: "sub_1" },
    };
    const api = apiWith(stubBilling(event));
    const res = await api.fetch(
      new Request("https://test.local/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "test" },
        body: "{}",
      }),
      env as never,
    );
    expect(res.status).toBe(200);
    expect(await tierOf("u_web")).toBe("plus");
  });

  it("is idempotent: the same event id twice makes one change", async () => {
    await seedProfile("u_idem", { subscriptionTier: "free" });
    const event: BillingEventLite = {
      id: "evt_dup",
      type: "checkout.session.completed",
      object: { client_reference_id: "u_idem", customer: "cus_2", subscription: "sub_2" },
    };
    const api = apiWith(stubBilling(event));
    const post = () =>
      api.fetch(
        new Request("https://test.local/webhooks/stripe", {
          method: "POST",
          headers: { "stripe-signature": "test" },
          body: "{}",
        }),
        env as never,
      );

    const first = await post();
    expect(first.status).toBe(200);
    expect(await tierOf("u_idem")).toBe("plus");

    // Simulate a state the duplicate must NOT re-apply: flip back to free, then replay.
    const db = createDb(env.DB);
    await db
      .update(schema.profiles)
      .set({ subscriptionTier: "free" })
      .where(eq(schema.profiles.id, "u_idem"));

    const second = await post();
    const body = (await second.json()) as { duplicate?: boolean };
    expect(body.duplicate).toBe(true);
    expect(await tierOf("u_idem")).toBe("free"); // the replay was a no-op
  });

  it("a subscription.deleted webhook drops the tier to free", async () => {
    await seedProfile("u_cancel", { subscriptionTier: "plus", stripeCustomerId: "cus_9" });
    const event: BillingEventLite = {
      id: "evt_cancel_1",
      type: "customer.subscription.deleted",
      object: { customer: "cus_9", status: "active" },
    };
    const api = apiWith(stubBilling(event));
    const res = await api.fetch(
      new Request("https://test.local/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "test" },
        body: "{}",
      }),
      env as never,
    );
    expect(res.status).toBe(200);
    expect(await tierOf("u_cancel")).toBe("free");
  });
});
