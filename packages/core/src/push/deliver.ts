// Push delivery for one notification: gate on prefs + quiet hours (domain/push), send Expo messages, prune tokens Expo reports
// DeviceNotRegistered. fetch, clock and KV are injected so the pipeline is integration-testable with a stub fetch. In-app notifications are unaffected.
import { logEvent } from "@dustinedwards/site-runtime/log";
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
      data: { notificationId, ...ctx.notification.data },
    },
  );
  const tickets = await sendExpoPush(messages, deps.fetchImpl);
  const dead = deadTokensFromTickets(messages, tickets);
  if (dead.length > 0) await pushRepo.pruneTokens(db, dead);

  return { delivered: messages.length - dead.length, pruned: dead.length, reason: "ok" };
}

export type SweepResult = { scanned: number; delivered: number };

/** Sweeps notifications since a cutoff and delivers each exactly once, deduped via KV (pushed:<id>); keeps core binding-free at the cost of sweep-cadence latency. */
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
    // One failing notification must not stop the sweep or leave the cursor behind it.
    const res = await deliverPush(db, deps, n.id).catch((err) => {
      logEvent("push_delivery_failed", { error: err }, { level: "error" });
      return { delivered: 0 };
    });
    if (deps.kv) await deps.kv.put(key, "1", { expirationTtl: 7 * 24 * 3600 });
    if (res.delivered > 0) delivered++;
  }
  return { scanned: rows.length, delivered };
}
