import { describe, expect, it } from "vitest";
import { wrapD1 } from "../src/db";

// A minimal fake D1 binding whose read (`all`) and write (`run`) executors are
// driven by injected callbacks, so we can assert the retry policy: reads are
// retried on a transient throw, writes are never retried (to avoid double-apply).
function makeFakeD1(handlers: {
  all?: (call: number) => Promise<unknown>;
  run?: (call: number) => Promise<unknown>;
}) {
  const counts = { all: 0, run: 0, bind: 0 };
  const stmt = {
    bind() {
      counts.bind++;
      return stmt;
    },
    async all() {
      counts.all++;
      return handlers.all ? handlers.all(counts.all) : { results: [] };
    },
    async run() {
      counts.run++;
      return handlers.run ? handlers.run(counts.run) : { success: true };
    },
    async raw() {
      return [];
    },
    async first() {
      return null;
    },
  };
  const d1 = {
    prepare() {
      return stmt;
    },
  } as unknown as D1Database;
  return { d1, counts };
}

describe("wrapD1 read retry", () => {
  it("retries an idempotent read that throws transiently, then succeeds", async () => {
    const { d1, counts } = makeFakeD1({
      all: async (call) => {
        if (call < 3) throw new Error("Network connection lost");
        return { results: [{ ok: 1 }] };
      },
    });
    const wrapped = wrapD1(d1);
    const result = await wrapped.prepare("select 1").bind().all();
    expect(result).toEqual({ results: [{ ok: 1 }] });
    expect(counts.all).toBe(3);
  });

  it("gives up after the attempt cap and rethrows the last error", async () => {
    const { d1, counts } = makeFakeD1({
      all: async () => {
        throw new Error("storage caused object to be reset");
      },
    });
    const wrapped = wrapD1(d1);
    await expect(wrapped.prepare("select 1").bind().all()).rejects.toThrow(
      /storage caused object to be reset/,
    );
    expect(counts.all).toBe(3);
  });

  it("does NOT retry a write, so a mutation is never re-applied", async () => {
    const { d1, counts } = makeFakeD1({
      run: async () => {
        throw new Error("Network connection lost");
      },
    });
    const wrapped = wrapD1(d1);
    await expect(wrapped.prepare("update x set y=1").bind().run()).rejects.toThrow();
    expect(counts.run).toBe(1);
  });
});
