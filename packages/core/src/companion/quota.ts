// Pure quota logic (security-open-items.md item 4). The D1 counter is companionRepo.reserveUsage/settleUsage;
// everything here is testable without a binding. A call's real cost is only known once it settles, so a request
// reserves its worst case first (the cap is checked and the reservation added in one statement) and is settled to
// the real cost after. A reply that fails or is cancelled keeps its reservation: the model may have been billed.
import { type CompanionRole, estimateCostCents } from "./models";

/** The quota's day, YYYYMMDD in UTC: one counter row per reader per day. */
export function quotaDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

/** ISO timestamp of the next UTC midnight, when the quota resets. */
export function quotaResetsAt(date: Date = new Date()): string {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
  return next.toISOString();
}

/**
 * The most a call can cost, reserved before it is made: its input at one token per three characters (English runs
 * nearer four, so this overestimates) and its full output cap.
 */
export function reserveCents(
  role: CompanionRole,
  inputChars: number,
  maxOutputTokens: number,
): number {
  return estimateCostCents(role, Math.ceil(inputChars / 3), maxOutputTokens);
}
