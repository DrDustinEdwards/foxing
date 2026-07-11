import { describe, expect, it } from "vitest";
import {
  addUsage,
  EMPTY_QUOTA_STATE,
  isOverQuota,
  quotaKey,
  quotaResetsAt,
} from "../src/companion/quota";
import { COMPANION_QUOTA } from "../src/config/companion";

describe("companion quota (cost-based, not request-count-based)", () => {
  it("starts open", () => {
    expect(isOverQuota(EMPTY_QUOTA_STATE)).toBe(false);
  });

  it("trips on the cost ceiling well before the request backstop, for expensive calls", () => {
    // A handful of deep-role calls (tens of cents each) should exceed the $3 ceiling
    // long before 200 requests -- proving the gate is cost-driven, not count-driven.
    let state = EMPTY_QUOTA_STATE;
    let calls = 0;
    while (!isOverQuota(state) && calls < COMPANION_QUOTA.dailyRequestBackstop) {
      state = addUsage(state, 50); // 50 cents, a deep_dive-sized call
      calls++;
    }
    expect(isOverQuota(state)).toBe(true);
    expect(calls).toBeLessThan(COMPANION_QUOTA.dailyRequestBackstop);
  });

  it("the request-count backstop trips a flood of cheap calls even under the cost ceiling", () => {
    let state = EMPTY_QUOTA_STATE;
    for (let i = 0; i < COMPANION_QUOTA.dailyRequestBackstop; i++) {
      state = addUsage(state, 0); // free-cost calls should never happen, but must still be bounded
    }
    expect(state.costCents).toBeLessThan(COMPANION_QUOTA.dailyCostCeilingCents);
    expect(isOverQuota(state)).toBe(true);
  });

  it("builds a stable per-user-per-day key", () => {
    const day = new Date("2026-07-10T15:00:00Z");
    expect(quotaKey("user-1", day)).toBe("companion-quota:user-1:20260710");
    // Same calendar day, different time: same key.
    expect(quotaKey("user-1", new Date("2026-07-10T23:59:00Z"))).toBe(
      "companion-quota:user-1:20260710",
    );
  });

  it("resets at the next UTC midnight", () => {
    const day = new Date("2026-07-10T15:00:00Z");
    expect(quotaResetsAt(day)).toBe("2026-07-11T00:00:00.000Z");
  });
});
