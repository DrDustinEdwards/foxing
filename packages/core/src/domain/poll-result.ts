// Pure poll-counting functions (Phase 5). No DB, no I/O: given the option ids and the
// cast ballots (each an ordered list of option ids), compute tallies and a winner.
// Unit-tested in isolation (poll-result.test.ts). The API layer calls these; the live
// layer broadcasts firstPreferenceTallies as votes arrive, and the close event
// persists computePollResult in its data json.
//
// Single-choice polls store a one-element ranks array and resolve by plurality.
// IRV polls resolve by instant-runoff elimination.

export type Ballot = string[]; // ordered option ids, most-preferred first

/** First-preference counts per option: the live tally shown while voting is open. */
export function firstPreferenceTallies(
  optionIds: readonly string[],
  ballots: readonly Ballot[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of optionIds) counts[id] = 0;
  for (const ballot of ballots) {
    const top = ballot.find((id) => id in counts);
    if (top !== undefined) counts[top] += 1;
  }
  return counts;
}

export type PollResult = {
  winnerId: string | null; // null only when there are no valid ballots
  isTie: boolean; // the deciding round had a tie for the lead (winner picked deterministically)
  finalCounts: Record<string, number>;
  rounds: Array<{
    counts: Record<string, number>;
    eliminatedId: string | null; // null on the deciding round
    exhausted: number; // ballots with no remaining ranked option this round
  }>;
};

// Deterministic tie-break for the leader when counts are equal: earliest in the
// original option order wins. For elimination: the tied-for-fewest option that is
// LATEST in the original order is removed first (stable, replayable).
function leaderByOrder(
  optionIds: readonly string[],
  counts: Record<string, number>,
  among: ReadonlySet<string>,
): string {
  let best: string | null = null;
  for (const id of optionIds) {
    if (!among.has(id)) continue;
    if (best === null || counts[id] > counts[best]) best = id;
  }
  return best as string;
}

function loserByOrder(
  optionIds: readonly string[],
  counts: Record<string, number>,
  among: ReadonlySet<string>,
): string {
  let worst: string | null = null;
  for (const id of optionIds) {
    if (!among.has(id)) continue;
    // strictly-less keeps the FIRST minimum; but we want the LAST tied minimum out
    // first, so use <= to let later-listed ties overwrite.
    if (worst === null || counts[id] <= counts[worst]) worst = id;
  }
  return worst as string;
}

/** Plurality winner (single-choice). Ties broken by original option order. */
export function computePlurality(
  optionIds: readonly string[],
  ballots: readonly Ballot[],
): PollResult {
  const counts = firstPreferenceTallies(optionIds, ballots);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return { winnerId: null, isTie: false, finalCounts: counts, rounds: [] };
  }
  const all = new Set(optionIds);
  const winnerId = leaderByOrder(optionIds, counts, all);
  const top = counts[winnerId];
  const isTie = optionIds.filter((id) => counts[id] === top).length > 1;
  return {
    winnerId,
    isTie,
    finalCounts: counts,
    rounds: [{ counts, eliminatedId: null, exhausted: 0 }],
  };
}

/** Instant-runoff winner. Eliminates the fewest-first-choice option each round and
 *  redistributes its ballots until one option holds a majority of active ballots. */
export function computeIrv(optionIds: readonly string[], ballots: readonly Ballot[]): PollResult {
  const remaining = new Set(optionIds);
  const rounds: PollResult["rounds"] = [];

  while (remaining.size > 0) {
    const counts: Record<string, number> = {};
    for (const id of remaining) counts[id] = 0;
    let active = 0;
    for (const ballot of ballots) {
      const top = ballot.find((id) => remaining.has(id));
      if (top !== undefined) {
        counts[top] += 1;
        active += 1;
      }
    }
    const exhausted = ballots.length - active;

    if (active === 0) {
      rounds.push({ counts, eliminatedId: null, exhausted });
      return { winnerId: null, isTie: false, finalCounts: counts, rounds };
    }

    const leader = leaderByOrder(optionIds, counts, remaining);
    const majority = Math.floor(active / 2) + 1;
    if (counts[leader] >= majority || remaining.size === 1) {
      const top = counts[leader];
      const isTie = [...remaining].filter((id) => counts[id] === top).length > 1;
      rounds.push({ counts, eliminatedId: null, exhausted });
      return { winnerId: leader, isTie, finalCounts: counts, rounds };
    }

    const loser = loserByOrder(optionIds, counts, remaining);
    rounds.push({ counts, eliminatedId: loser, exhausted });
    remaining.delete(loser);
  }

  // Unreachable for a non-empty option list, but keeps the return total.
  return { winnerId: null, isTie: false, finalCounts: {}, rounds };
}

/** Resolve a poll by its type. Single = plurality, irv = instant-runoff. */
export function computePollResult(
  pollType: "single" | "irv",
  optionIds: readonly string[],
  ballots: readonly Ballot[],
): PollResult {
  return pollType === "irv" ? computeIrv(optionIds, ballots) : computePlurality(optionIds, ballots);
}
