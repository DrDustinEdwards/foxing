// The edges of the offline sync protocol's pure core, resolveSyncOp, that the API tests in
// apps/web/test/sync.integration.test.ts do not reach: an equal timestamp, upsert-recovery
// when a create op was lost, and the append-only rules for sessions.
import { describe, expect, it } from "vitest";
import { resolveSyncOp } from "../src/domain/sync";

const existingAt = (ms: number) => ({ updatedAt: ms });

describe("resolveSyncOp - update (row-level LWW)", () => {
  it("applies when the op is exactly as new (>=)", () => {
    expect(resolveSyncOp(existingAt(200), { verb: "update", clientTs: 200 })).toEqual({
      action: "update",
    });
  });
  it("upsert-recovers: an update for a missing row inserts it (create op was lost)", () => {
    expect(resolveSyncOp(null, { verb: "update", clientTs: 200 })).toEqual({ action: "insert" });
  });
});

describe("resolveSyncOp - delete idempotency", () => {
  it("deletes an existing row", () => {
    expect(resolveSyncOp(existingAt(10), { verb: "delete", clientTs: 20 })).toEqual({
      action: "delete",
    });
  });
});

describe("resolveSyncOp - append-only (sessions)", () => {
  const appendOnly = { appendOnly: true };
  it("re-creating the same session id is an idempotent no-op", () => {
    expect(resolveSyncOp(existingAt(5), { verb: "create", clientTs: 9 }, appendOnly)).toEqual({
      action: "noop",
      reason: "replay",
    });
  });
  it("never deletes a session (append-only)", () => {
    expect(resolveSyncOp(existingAt(5), { verb: "delete", clientTs: 9 }, appendOnly)).toEqual({
      action: "noop",
      reason: "append_only",
    });
  });
});
