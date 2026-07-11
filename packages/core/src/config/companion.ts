// Per-user daily companion quota (security-open-items.md item 4). Gated on ESTIMATED
// COST, not request count: deep_dive costs roughly 30x word_lookup, so a flat request
// quota either starves cheap actions or lets a user burn 30x the intended budget by
// only calling expensive ones. The request-count backstop below exists only to stop a
// fast-action loop under the cost ceiling, not as the primary control.
export const COMPANION_QUOTA = {
  /** Launch default. Tighten with real usage data once Plus has paying users. */
  dailyCostCeilingCents: 300, // $3.00/user/day equivalent
  dailyRequestBackstop: 200,
} as const;
