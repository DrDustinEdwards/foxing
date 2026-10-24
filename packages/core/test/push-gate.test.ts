// Phase 7 push delivery gate (D18). shouldDeliverPush is pure; nowUtcMs + timezone are
// injected so quiet-hours math is deterministic. Covers category overrides,
// quiet hours (including the wrap past midnight and timezone conversion), and unknown
// categories. In-app notifications always land; this gate only governs the Expo push.
import { describe, expect, it } from "vitest";
import { categoryEnabled, inQuietHours, shouldDeliverPush } from "../src/domain/push";

// A fixed UTC instant: 2026-01-15T03:00:00Z (03:00 UTC).
const UTC_0300 = Date.UTC(2026, 0, 15, 3, 0, 0);

describe("category overrides", () => {
  it("an explicit user override beats the default", () => {
    expect(categoryEnabled("reactions", { categories: { reactions: true } })).toBe(true);
    expect(categoryEnabled("club_replies", { categories: { club_replies: false } })).toBe(false);
  });
});

describe("quiet hours", () => {
  it("no quiet window configured -> never quiet", () => {
    expect(inQuietHours(UTC_0300, "UTC", null)).toBe(false);
  });
  it("simple daytime window (09:00-17:00) at 03:00 UTC is outside", () => {
    expect(inQuietHours(UTC_0300, "UTC", { start: "09:00", end: "17:00" })).toBe(false);
  });
  it("wrap-past-midnight window (22:00-07:00) at 03:00 UTC is inside", () => {
    expect(inQuietHours(UTC_0300, "UTC", { start: "22:00", end: "07:00" })).toBe(true);
  });
  it("respects timezone: 03:00 UTC is 22:00 in New York (inside 22:00-07:00)", () => {
    // America/New_York is UTC-5 in January, so 03:00Z = 22:00 local.
    expect(inQuietHours(UTC_0300, "America/New_York", { start: "22:00", end: "07:00" })).toBe(true);
  });
  it("same timezone but a daytime window is outside at 22:00 local", () => {
    expect(inQuietHours(UTC_0300, "America/New_York", { start: "08:00", end: "20:00" })).toBe(
      false,
    );
  });
});

describe("shouldDeliverPush", () => {
  const base = { timezone: "UTC", nowUtcMs: UTC_0300 };
  it("delivers a default-on category outside quiet hours", () => {
    expect(shouldDeliverPush({ notificationType: "post_reply", ...base })).toEqual({
      deliver: true,
      reason: "ok",
    });
  });
  it("suppresses a default-off category", () => {
    expect(shouldDeliverPush({ notificationType: "reaction", ...base })).toEqual({
      deliver: false,
      reason: "category_off",
    });
  });
  it("suppresses inside quiet hours even for an on category", () => {
    expect(
      shouldDeliverPush({
        notificationType: "post_reply",
        prefs: { quietHours: { start: "22:00", end: "07:00" } },
        ...base,
      }),
    ).toEqual({ deliver: false, reason: "quiet_hours" });
  });
  it("suppresses an unknown notification type", () => {
    expect(shouldDeliverPush({ notificationType: "mystery", ...base })).toEqual({
      deliver: false,
      reason: "unknown_category",
    });
  });
});
