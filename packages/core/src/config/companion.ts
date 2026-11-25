// Per-user daily quota gated on ESTIMATED COST, not request count: deep_dive costs ~30x word_lookup, so a flat count either starves cheap
// actions or lets a user burn 30x the budget. The request-count backstop only stops a fast-action loop under the cost ceiling.
export const COMPANION_QUOTA = {
  dailyCostCeilingCents: 300, // $3.00/user/day equivalent
  dailyRequestBackstop: 200,
} as const;
