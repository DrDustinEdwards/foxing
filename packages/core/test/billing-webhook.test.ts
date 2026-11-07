import { describe, expect, it } from "vitest";
import { interpretStripeEvent, tierForStatus } from "../src/billing/webhook";

describe("tierForStatus", () => {
  it("is plus while the subscription is active or in its trial", () => {
    expect(tierForStatus("active")).toBe("plus");
    expect(tierForStatus("trialing")).toBe("plus");
  });

  it("is free for every lapsed / dunning status", () => {
    for (const status of ["canceled", "unpaid", "incomplete_expired", "past_due", "paused"]) {
      expect(tierForStatus(status)).toBe("free");
    }
  });
});

describe("interpretStripeEvent", () => {
  it("links the user to the customer on checkout.session.completed", () => {
    const intent = interpretStripeEvent({
      id: "evt_1",
      type: "checkout.session.completed",
      object: { client_reference_id: "user_1", customer: "cus_1", subscription: "sub_1" },
    });
    expect(intent).toEqual({
      op: "link",
      userId: "user_1",
      customerId: "cus_1",
      subscriptionId: "sub_1",
    });
  });

  it("ignores checkout.session.completed missing the user reference", () => {
    const intent = interpretStripeEvent({
      id: "evt_2",
      type: "checkout.session.completed",
      object: { customer: "cus_1" },
    });
    expect(intent.op).toBe("ignore");
  });

  it("syncs plus from an active subscription and free from a lapsed one", () => {
    const active = interpretStripeEvent({
      id: "evt_3",
      type: "customer.subscription.updated",
      object: { customer: "cus_1", status: "active", current_period_end: 1780000000 },
    });
    expect(active).toMatchObject({
      op: "sync",
      customerId: "cus_1",
      tier: "plus",
      status: "active",
      periodEnd: 1780000000,
    });

    const pastDue = interpretStripeEvent({
      id: "evt_4",
      type: "customer.subscription.updated",
      object: { customer: "cus_1", status: "past_due" },
    });
    expect(pastDue).toMatchObject({
      op: "sync",
      tier: "free",
      status: "past_due",
      periodEnd: null,
    });
  });

  it("treats subscription.deleted as canceled -> free regardless of the object status", () => {
    const intent = interpretStripeEvent({
      id: "evt_5",
      type: "customer.subscription.deleted",
      object: { customer: "cus_1", status: "active" },
    });
    expect(intent).toMatchObject({ op: "sync", tier: "free", status: "canceled" });
  });

  it("records past_due on invoice.payment_failed without dropping tier", () => {
    const intent = interpretStripeEvent({
      id: "evt_6",
      type: "invoice.payment_failed",
      object: { customer: "cus_1" },
    });
    expect(intent).toEqual({ op: "status", customerId: "cus_1", status: "past_due" });
  });

  it("ignores unrelated events", () => {
    expect(interpretStripeEvent({ id: "evt_7", type: "customer.created", object: {} }).op).toBe(
      "ignore",
    );
  });
});
