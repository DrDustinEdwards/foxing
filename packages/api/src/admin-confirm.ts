// Single-use confirmation tokens for admin role and permission changes (grant or revoke
// admin, change tier, suspend or unsuspend). A preview mints a token bound to the actor,
// the target, the kind of change, the new value and the value the preview saw, and keeps
// it in APP_KV for CONFIRM_TTL_SECONDS. A perform redeems it once. The route's setter
// then writes only while the row still holds the previewed value, so a token that is
// unknown, spent, expired, stale, or minted for another actor, target or change cannot
// perform anything.
import { errors } from "./error";

export type RoleChangeKind = "admin" | "tier" | "suspend";
export type RoleValue = boolean | string;

export type PendingRoleChange = {
  actor: string;
  target: string;
  kind: RoleChangeKind;
  from: RoleValue;
  to: RoleValue;
  expiresAt: number;
};

/** How long a preview stays performable. KV's own expiry floor is 60 seconds. */
export const CONFIRM_TTL_SECONDS = 120;

/** 32 random bytes, hex. The perform body schema checks this shape. */
export const CONFIRM_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

const KEY_PREFIX = "admin-confirm:";

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function mintConfirmation(
  kv: KVNamespace,
  change: Omit<PendingRoleChange, "expiresAt">,
): Promise<{ token: string; expiresAt: string }> {
  const token = newToken();
  const expiresAt = Date.now() + CONFIRM_TTL_SECONDS * 1000;
  const pending: PendingRoleChange = { ...change, expiresAt };
  await kv.put(KEY_PREFIX + token, JSON.stringify(pending), {
    expirationTtl: CONFIRM_TTL_SECONDS,
  });
  return { token, expiresAt: new Date(expiresAt).toISOString() };
}

/**
 * Spends a token and returns the change it was minted for. Refuses (409) a token that
 * is unknown, already spent or expired, and one minted for a different actor, target,
 * kind of change or new value. A token that matches is deleted before the caller
 * writes, so it cannot be used twice even if the write then fails.
 */
export async function redeemConfirmation(
  kv: KVNamespace,
  token: string,
  expected: Pick<PendingRoleChange, "actor" | "target" | "kind" | "to">,
): Promise<PendingRoleChange> {
  const key = KEY_PREFIX + token;
  const raw = await kv.get(key);
  if (!raw) {
    throw errors.conflict(
      "This confirmation has expired or was already used. Preview the change again.",
    );
  }
  const pending = JSON.parse(raw) as PendingRoleChange;
  if (
    pending.actor !== expected.actor ||
    pending.target !== expected.target ||
    pending.kind !== expected.kind ||
    pending.to !== expected.to
  ) {
    throw errors.conflict(
      "This confirmation was issued for a different change. Preview the change again.",
    );
  }
  await kv.delete(key);
  if (pending.expiresAt <= Date.now()) {
    throw errors.conflict("This confirmation has expired. Preview the change again.");
  }
  return pending;
}
