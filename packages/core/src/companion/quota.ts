// Pure quota logic; the D1 counter is companionRepo.reserveUsage/settleUsage. A call's real cost is known only once it settles, so a request
// reserves its worst case first and is settled after; a reply that fails or is canceled keeps its reservation (the model may have been billed).
import { type CompanionRole, estimateCostCents } from "./models";

export function quotaDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

export function quotaResetsAt(date: Date = new Date()): string {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
  return next.toISOString();
}

/** The most a call can cost, reserved first: its input at one token per three characters (English runs nearer four, so this overestimates) and its full output cap. */
export function reserveCents(
  role: CompanionRole,
  inputChars: number,
  maxOutputTokens: number,
): number {
  // Every input token at the uncached price, the dearest a prompt can be except a cache write, which is never more
  // than a quarter above it and is covered by the one-token-per-three-characters overestimate.
  return estimateCostCents(role, {
    input: Math.ceil(inputChars / 3),
    output: maxOutputTokens,
    cacheRead: 0,
    cacheWrite: 0,
    cacheWrite1h: 0,
  });
}
