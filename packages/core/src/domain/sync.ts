// Offline sync. resolveSyncOp is the PURE conflict-resolution core; applySync/pullSync run it against D1. Contract:
//   - create: insert if absent; a replayed create (client id already present) is an
//     idempotent no-op. Client nanoids make offline creates safe to replay.
//   - update: row-level LWW on updated_at -- apply only if the op is at least as new as
//     the stored row; an update for a missing row upserts (create op was lost).
//   - user_book progress: greatest client_ts wins (LWW on updated_at, which we stamp
//     from client_ts on every synced write).
//   - session: append-only; only create applies, updates/deletes are no-ops.
//   - delete: idempotent; deleting a missing row is success.
// Every op is scoped to the session user; payload.user_id is never trusted.
import { logEvent } from "@dustinedwards/site-runtime/log";
import type { Db } from "../db";
import { syncAdapters, type Existing } from "../repositories/sync";
import { syncPayloadSchemas, type SyncOp, type SyncResource } from "../validators/sync";
import { domainErrors } from "./errors";
import { recordReadingSession } from "./library";

export type SyncDecision =
  | { action: "insert" }
  | { action: "update" }
  | { action: "delete" }
  | { action: "noop"; reason: "replay" | "stale" | "append_only" | "missing_ok" };

export function resolveSyncOp(
  existing: Existing,
  op: { verb: SyncOp["verb"]; clientTs: number },
  opts: { appendOnly?: boolean } = {},
): SyncDecision {
  if (opts.appendOnly) {
    if (op.verb === "create") {
      return existing ? { action: "noop", reason: "replay" } : { action: "insert" };
    }
    return { action: "noop", reason: "append_only" };
  }

  switch (op.verb) {
    case "create":
      return existing ? { action: "noop", reason: "replay" } : { action: "insert" };
    case "update":
      if (!existing) return { action: "insert" };
      return op.clientTs >= existing.updatedAt
        ? { action: "update" }
        : { action: "noop", reason: "stale" };
    default:
      return existing ? { action: "delete" } : { action: "noop", reason: "missing_ok" };
  }
}

export type SyncOpResult = {
  id: string;
  status: "applied" | "skipped";
  action: SyncDecision["action"];
  reason?: string;
  error?: string;
};

export async function applySync(db: Db, userId: string, ops: SyncOp[]): Promise<SyncOpResult[]> {
  const results: SyncOpResult[] = [];
  for (const op of ops) {
    try {
      if (op.verb !== "delete") {
        const schema = syncPayloadSchemas[op.resource];
        const parsed = schema.safeParse(op.payload ?? {});
        if (!parsed.success) {
          results.push({ id: op.id, status: "skipped", action: "noop", error: "invalid_payload" });
          continue;
        }
        op.payload = parsed.data as Record<string, unknown>;
      }

      const adapter = syncAdapters[op.resource];
      const existing = await adapter.probe(db, userId, op);
      const decision = resolveSyncOp(existing, op, { appendOnly: adapter.appendOnly });

      switch (decision.action) {
        case "insert":
          await adapter.insert(db, userId, op);
          if (op.resource === "session") {
            const p = op.payload as { startedAt: number; pagesRead?: number };
            await recordReadingSession(db, userId, p.startedAt, p.pagesRead ?? 0);
          }
          break;
        case "update":
          await adapter.update(db, userId, op);
          break;
        case "delete":
          await adapter.remove(db, userId, op);
          break;
        case "noop":
          results.push({ id: op.id, status: "skipped", action: "noop", reason: decision.reason });
          continue;
      }
      results.push({ id: op.id, status: "applied", action: decision.action });
    } catch (err) {
      logEvent("sync_apply_failed", { error: err, resource: op.resource }, { level: "error" });
      results.push({ id: op.id, status: "skipped", action: "noop", error: "apply_failed" });
    }
  }
  return results;
}

// 5s overlap window: re-send rows changed just before the cursor so a write racing the
// previous pull is never missed. The client upsert is idempotent, so overlap is safe.
const OVERLAP_MS = 5_000;

const PULL_RESOURCES: SyncResource[] = [
  "annotation",
  "user_book",
  "session",
  "vocabulary",
  "diary",
];

export type SyncPull = {
  cursor: number;
  changes: Record<string, unknown[]>;
};

export async function pullSync(db: Db, userId: string, since: number): Promise<SyncPull> {
  const sinceMs = Math.max(0, since - OVERLAP_MS);
  const changes: Record<string, unknown[]> = {};
  let maxTs = since;

  for (const resource of PULL_RESOURCES) {
    const rows = await syncAdapters[resource].listChanged(db, userId, sinceMs);
    changes[resource] = rows;
    for (const row of rows as Array<Record<string, unknown>>) {
      const ts = changeTs(row);
      if (ts > maxTs) maxTs = ts;
    }
  }

  return { cursor: maxTs, changes };
}

function changeTs(row: Record<string, unknown>): number {
  const v = row.updatedAt ?? row.createdAt;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Date.parse(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

/** Rejects a resource the sync protocol does not own, so online-only data (clubs, social) never goes through the single-owner path. */
export function assertSyncResource(resource: string): asserts resource is SyncResource {
  if (!(resource in syncAdapters)) {
    throw domainErrors.validation(`Resource '${resource}' is not syncable.`);
  }
}
