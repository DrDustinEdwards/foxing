import { describe, expect, it } from "vitest";
import {
  computeIrv,
  computePlurality,
  computePollResult,
  firstPreferenceTallies,
} from "../src/domain/poll-result";

const OPTS = ["a", "b", "c"];

describe("firstPreferenceTallies", () => {
  it("counts each ballot's first surviving option", () => {
    const t = firstPreferenceTallies(OPTS, [["a"], ["a"], ["b"], ["c", "a"]]);
    expect(t).toEqual({ a: 2, b: 1, c: 1 });
  });

  it("ignores unknown option ids", () => {
    const t = firstPreferenceTallies(OPTS, [["z", "b"], ["x"]]);
    expect(t).toEqual({ a: 0, b: 1, c: 0 });
  });
});

describe("computePlurality (single-choice)", () => {
  it("picks the option with the most first choices", () => {
    const r = computePlurality(OPTS, [["a"], ["a"], ["b"]]);
    expect(r.winnerId).toBe("a");
    expect(r.isTie).toBe(false);
    expect(r.finalCounts).toEqual({ a: 2, b: 1, c: 0 });
  });

  it("flags a tie and breaks it deterministically by option order", () => {
    const r = computePlurality(OPTS, [["b"], ["c"]]);
    expect(r.isTie).toBe(true);
    expect(r.winnerId).toBe("b"); // earliest in option order among the tied
  });

  it("returns no winner when there are no ballots", () => {
    const r = computePlurality(OPTS, []);
    expect(r.winnerId).toBeNull();
  });
});

describe("computeIrv", () => {
  it("declares a first-round winner on an outright majority", () => {
    const r = computeIrv(OPTS, [["a"], ["a"], ["a"], ["b"]]);
    expect(r.winnerId).toBe("a");
    expect(r.rounds).toHaveLength(1);
    expect(r.rounds[0].eliminatedId).toBeNull();
  });

  it("eliminates the last-place option and redistributes its ballots", () => {
    // Round 1: a=2, b=2, c=1 -> eliminate c. c's ballot's next pick is b.
    // Round 2: a=2, b=3 -> b wins with a majority of 5.
    const ballots = [["a"], ["a"], ["b"], ["b"], ["c", "b"]];
    const r = computeIrv(OPTS, ballots);
    expect(r.rounds[0].counts).toEqual({ a: 2, b: 2, c: 1 });
    expect(r.rounds[0].eliminatedId).toBe("c");
    expect(r.winnerId).toBe("b");
  });

  it("breaks an elimination tie by removing the later-listed option first", () => {
    // a=1, b=1, c=1 all tied for last; the later-listed (c) is eliminated first.
    const r = computeIrv(OPTS, [["a"], ["b"], ["c"]]);
    expect(r.rounds[0].eliminatedId).toBe("c");
  });

  it("counts exhausted ballots when a ballot has no surviving preference", () => {
    // Round 1: a=1, b=1, c=1 -> eliminate c. c had no next pick -> exhausts.
    const r = computeIrv(OPTS, [["a"], ["b"], ["c"]]);
    const last = r.rounds[r.rounds.length - 1];
    expect(last.exhausted).toBeGreaterThanOrEqual(1);
  });

  it("returns no winner for an empty ballot set", () => {
    expect(computeIrv(OPTS, []).winnerId).toBeNull();
  });
});

describe("computePollResult routing", () => {
  it("routes single to plurality and irv to instant-runoff", () => {
    const ballots = [["a", "b"], ["b", "a"], ["b"]];
    expect(computePollResult("single", OPTS, ballots).winnerId).toBe("b");
    expect(computePollResult("irv", OPTS, ballots).winnerId).toBe("b");
  });
});
