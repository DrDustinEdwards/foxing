// Push delivery orchestrator. Ties the pieces together for one notification:
// load context -> gate on prefs + quiet hours (domain/push) -> build + send Expo
// messages -> prune tokens Expo reports DeviceNotRegistered. Dependencies (fetch, clock,
// KV) are injected so the whole pipeline is integration-testable against local D1 with a
// stub fetch -- no device required. In-app notifications are unaffected; this governs
// only the push.
import type { Db } from "../db";
import { shouldDeliverPush } from "../domain/push";
import * as notificationsRepo from "../repositories/notifications";
import * as pushRepo from "../repositories/push";
import { buildExpoMessages, deadTokensFromTickets, sendExpoPush } from "./expo";

export type PushKv = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
};

export type PushDeps = {
  fetchImpl: typeof fetch;
  nowUtcMs: number;
  kv?: PushKv;
};

export type DeliverResult = {
  delivered: number;
  pruned: number;
  reason: "ok" | "no_context" | "no_tokens" | "category_off" | "quiet_hours" | "unknown_category";
};

export async function deliverPush(
  db: Db,
  deps: PushDeps,
  notificationId: string,
): Promise<DeliverResult> {
  const ctx = await pushRepo.loadDeliveryContext(db, notificationId);
  if (!ctx) return { delivered: 0, pruned: 0, reason: "no_context" };

  const decision = shouldDeliverPush({
    notificationType: ctx.notification.type,
    prefs: ctx.prefs,
    timezone: ctx.timezone,
    nowUtcMs: deps.nowUtcMs,
  });
  if (!decision.deliver) return { delivered: 0, pruned: 0, reason: decision.reason };
  if (ctx.tokens.length === 0) return { delivered: 0, pruned: 0, reason: "no_tokens" };

  const messages = buildExpoMessages(
    ctx.tokens.map((t) => t.token),
    {
      title: ctx.notification.title,
      body: ctx.notification.body,
      data: { notificationId, ...(ctx.notification.data ?? {}) },
    },
  );
  const tickets = await sendExpoPush(messages, deps.fetchImpl);
  const dead = deadTokensFromTickets(messages, tickets);
  if (dead.length > 0) await pushRepo.pruneTokens(db, dead);

  return { delivered: messages.length - dead.length, pruned: dead.length, reason: "ok" };
}

export type SweepResult = { scanned: number; delivered: number };

/**
 * Sweep notifications created since a cutoff and push-deliver each one exactly once,
 * deduped via KV (key pushed:<id>). This is the producer seam: it keeps the core
 * binding-free (KV/fetch injected) and the notification write path unchanged, at the
 * cost of sweep-cadence latency rather than per-insert delivery. Upgradeable to a true
 * insert-time queue later without changing deliverPush.
 */
export async function sweepPushDeliveries(
  db: Db,
  deps: PushDeps,
  sinceMs: number,
): Promise<SweepResult> {
  const rows = await notificationsRepo.listCreatedSince(db, sinceMs);
  let delivered = 0;
  for (const n of rows) {
    const key = `pushed:${n.id}`;
    if (deps.kv) {
      const seen = await deps.kv.get(key);
      if (seen) continue;
    }
    const res = await deliverPush(db, deps, n.id);
    if (deps.kv) await deps.kv.put(key, "1", { expirationTtl: 7 * 24 * 3600 });
    if (res.delivered > 0) delivered++;
  }
  return { scanned: rows.length, delivered };
}
