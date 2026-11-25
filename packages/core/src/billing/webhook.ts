// Pure interpretation of a verified Stripe event into an intent the route executes; the route is the SINGLE writer of profiles.subscription_tier. No SDK, no DB.
import type { BillingEventLite } from "./client";

export function tierForStatus(status: string): "free" | "plus" {
  return status === "active" || status === "trialing" ? "plus" : "free";
}

const ENDED = new Set(["canceled", "incomplete_expired"]);

/** The newest still-live subscription, else the newest: a late event for an old subscription must not decide the tier of someone who has since resubscribed. */
export function pickCurrentSubscription<T extends { status: string }>(newestFirst: T[]): T | null {
  return newestFirst.find((s) => !ENDED.has(s.status)) ?? newestFirst[0] ?? null;
}

export type BillingIntent =
  | { op: "link"; userId: string; customerId: string; subscriptionId: string | null }
  | {
      op: "sync";
      customerId: string;
      tier: "free" | "plus";
      status: string;
      periodEnd: number | null;
    }
  // invoice.payment_failed: record the dunning status without dropping tier (Stripe
  // retries; an eventual .deleted/.updated is what actually cancels).
  | { op: "status"; customerId: string; status: string }
  | { op: "ignore" };

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

export function interpretStripeEvent(event: BillingEventLite): BillingIntent {
  const o = event.object;
  switch (event.type) {
    case "checkout.session.completed": {
      const userId = str(o.client_reference_id);
      const customerId = str(o.customer);
      if (!userId || !customerId) return { op: "ignore" };
      return { op: "link", userId, customerId, subscriptionId: str(o.subscription) };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const customerId = str(o.customer);
      if (!customerId) return { op: "ignore" };
      const status =
        event.type === "customer.subscription.deleted" ? "canceled" : (str(o.status) ?? "canceled");
      return {
        op: "sync",
        customerId,
        tier: tierForStatus(status),
        status,
        periodEnd: num(o.current_period_end),
      };
    }
    case "invoice.payment_failed": {
      const customerId = str(o.customer);
      if (!customerId) return { op: "ignore" };
      return { op: "status", customerId, status: "past_due" };
    }
    default:
      return { op: "ignore" };
  }
}
