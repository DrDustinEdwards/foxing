import { describe, expect, it } from "vitest";
import { periodRange } from "../src/repositories/library";

// periodRange is the pure date math behind books-goal progress. The D1-backed
// count + event emission are covered by the API integration tests in apps/web.
describe("periodRange", () => {
  it("month: December rolls the end into the next year", () => {
    const { start, end } = periodRange("month", 2026, 12);
    expect(start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("week: ISO week 1 of 2026 starts Monday 2025-12-29", () => {
    // 2026-01-01 is a Thursday, so ISO week 1 (contains the first Thursday)
    // starts on Monday 2025-12-29.
    const { start, end } = periodRange("week", 2026, undefined, 1);
    expect(start.toISOString()).toBe("2025-12-29T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-05T00:00:00.000Z");
  });

  it("falls back to the full year when month/week is missing", () => {
    const { start, end } = periodRange("month", 2026);
    expect(start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
