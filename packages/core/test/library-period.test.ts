import { describe, expect, it } from "vitest";
import { periodRange } from "../src/repositories/library";

// periodRange is the pure date math behind books-goal progress. The D1-backed
// count + event emission are covered by the API integration tests in apps/web.
describe("periodRange", () => {
  it("year: whole calendar year, half-open", () => {
    const { start, end } = periodRange("year", 2026);
    expect(start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("month: the given month, half-open into the next", () => {
    const { start, end } = periodRange("month", 2026, 2);
    expect(start.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

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

  it("week: spans exactly 7 days", () => {
    const { start, end } = periodRange("week", 2026, undefined, 10);
    expect((end.getTime() - start.getTime()) / 86400000).toBe(7);
  });

  it("falls back to the full year when month/week is missing", () => {
    const { start, end } = periodRange("month", 2026);
    expect(start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
