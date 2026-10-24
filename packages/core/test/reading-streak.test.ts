import { describe, expect, it } from "vitest";
import { localDay, nextStreak } from "../src/domain/library";

const DAY = 86_400_000;

describe("reading streak", () => {
  it("extends on the next day, holds on the same day, restarts after a gap", () => {
    let s = nextStreak({ current: 0, longest: 0, lastDay: null }, 100);
    expect(s).toEqual({ current: 1, longest: 1, lastDay: 100 });
    s = nextStreak(s, 100);
    expect(s.current).toBe(1);
    s = nextStreak(s, 101);
    expect(s).toEqual({ current: 2, longest: 2, lastDay: 101 });
    s = nextStreak(s, 104);
    expect(s).toEqual({ current: 1, longest: 2, lastDay: 104 });
  });

  it("ignores a late offline session from before the last reading day", () => {
    const s = { current: 3, longest: 5, lastDay: 200 };
    expect(nextStreak(s, 198)).toBe(s);
  });

  it("counts the day in the reader's timezone, not UTC", () => {
    // 2026-10-24 03:00 UTC is still the 23rd in New York.
    const at = Date.UTC(2026, 9, 24, 3);
    expect(localDay(at, "America/New_York")).toBe(localDay(at, "UTC") - 1);
    expect(localDay(at, "Not/AZone")).toBe(Math.floor(at / DAY));
  });
});
