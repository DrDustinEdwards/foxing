// Pure quota logic (security-open-items.md item 4). The API route owns the actual KV
// read/write (a Cloudflare binding); everything here is testable without one. Check
// happens before a call is made (can't know real output tokens until it completes);
// the call's actual cost is added to state only after it settles, so a request that
// fails or is aborted never counts against the quota.
import { COMPANION_QUOTA } from "../config/companion";

export type QuotaState = { costCents: number; requests: number };

export const EMPTY_QUOTA_STATE: QuotaState = { costCents: 0, requests: 0 };

/** KV key for a user's quota counter, scoped to one UTC calendar day. */
export function quotaKey(userId: string, date: Date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `companion-quota:${userId}:${stamp}`;
}

/** ISO timestamp of the next UTC midnight, when the quota resets. */
export function quotaResetsAt(date: Date = new Date()): string {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
  return next.toISOString();
}

/** True when either the cost ceiling or the request backstop has been reached. */
export function isOverQuota(state: QuotaState): boolean {
  return (
    state.costCents >= COMPANION_QUOTA.dailyCostCeilingCents ||
    state.requests >= COMPANION_QUOTA.dailyRequestBackstop
  );
}

/** Fold one settled call's actual cost into the day's running quota state. */
export function addUsage(state: QuotaState, costCents: number): QuotaState {
  return { costCents: state.costCents + costCents, requests: state.requests + 1 };
}
