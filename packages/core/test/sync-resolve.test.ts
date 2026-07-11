// The Phase 7 sync conflict-resolution matrix. resolveSyncOp is the pure core of the
// offline sync protocol; every rule from spec-cf-api is asserted here without D1:
// idempotent create replay, row-level LWW on update, progress = greatest client_ts
// (LWW on the stamped updated_at), append-only sessions, delete idempotency, and
// upsert-recovery when a create op was lost.
import { describe, expect, it } from "vitest";
import { resolveSyncOp } from "../src/domain/sync";

const existingAt = (ms: number) => ({ updatedAt: ms });

describe("resolveSyncOp - create", () => {
  it("inserts when the row is absent", () => {
    expect(resolveSyncOp(null, { verb: "create", clientTs: 100 })).toEqual({ action: "insert" });
  });
  it("is an idempotent no-op when the client id already exists (replay)", () => {
    expect(resolveSyncOp(existingAt(50), { verb: "create", clientTs: 100 })).toEqual({
      action: "noop",
      reason: "replay",
    });
  });
});

describe("resolveSyncOp - update (row-level LWW)", () => {
  it("applies when the op is newer than the stored row", () => {
    expect(resolveSyncOp(existingAt(100), { verb: "update", clientTs: 200 })).toEqual({
      action: "update",
    });
  });
  it("applies when the op is exactly as new (>=)", () => {
    expect(resolveSyncOp(existingAt(200), { verb: "update", clientTs: 200 })).toEqual({
      action: "update",
    });
  });
  it("skips (server wins) when the op is older than the stored row", () => {
    expect(resolveSyncOp(existingAt(300), { verb: "update", clientTs: 200 })).toEqual({
      action: "noop",
      reason: "stale",
    });
  });
  it("upsert-recovers: an update for a missing row inserts it (create op was lost)", () => {
    expect(resolveSyncOp(null, { verb: "update", clientTs: 200 })).toEqual({ action: "insert" });
  });
});

describe("resolveSyncOp - progress = greatest client_ts", () => {
  // user_book progress rides the same LWW: updated_at is stamped from client_ts, so the
  // greatest client_ts always wins regardless of arrival order.
  it("a later progress write wins over an earlier stored one", () => {
    expect(resolveSyncOp(existingAt(1000), { verb: "update", clientTs: 1001 }).action).toBe(
      "update",
    );
  });
  it("an out-of-order older progress write is dropped", () => {
    expect(resolveSyncOp(existingAt(1000), { verb: "update", clientTs: 999 })).toEqual({
      action: "noop",
      reason: "stale",
    });
  });
});

describe("resolveSyncOp - delete idempotency", () => {
  it("deletes an existing row", () => {
    expect(resolveSyncOp(existingAt(10), { verb: "delete", clientTs: 20 })).toEqual({
      action: "delete",
    });
  });
  it("deleting a missing row is a success no-op", () => {
    expect(resolveSyncOp(null, { verb: "delete", clientTs: 20 })).toEqual({
      action: "noop",
      reason: "missing_ok",
    });
  });
});

describe("resolveSyncOp - append-only (sessions)", () => {
  const appendOnly = { appendOnly: true };
  it("inserts a new session", () => {
    expect(resolveSyncOp(null, { verb: "create", clientTs: 5 }, appendOnly)).toEqual({
      action: "insert",
    });
  });
  it("re-creating the same session id is an idempotent no-op", () => {
    expect(resolveSyncOp(existingAt(5), { verb: "create", clientTs: 9 }, appendOnly)).toEqual({
      action: "noop",
      reason: "replay",
    });
  });
  it("never updates a session (append-only)", () => {
    expect(resolveSyncOp(existingAt(5), { verb: "update", clientTs: 9 }, appendOnly)).toEqual({
      action: "noop",
      reason: "append_only",
    });
  });
  it("never deletes a session (append-only)", () => {
    expect(resolveSyncOp(existingAt(5), { verb: "delete", clientTs: 9 }, appendOnly)).toEqual({
      action: "noop",
      reason: "append_only",
    });
  });
});
