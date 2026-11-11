// Confirmation tokens for admin role and permission changes (change tier, suspend or unsuspend), on
// site-runtime ./confirm-token. A preview mints a token whose signed claims are the actor, the target, the
// kind of change, the new value and the value the preview saw, good for CONFIRM_TTL_SECONDS. A perform
// redeems it once (its one-time id is spent in APP_KV). The route's setter then writes only while the row
// still holds the previewed value, so a token that is forged, spent, expired, stale, or minted for another
// actor, target or change cannot perform anything.
import { mintConfirm, redeemConfirm } from "@dustinedwards/site-runtime/confirm-token";
import { sha256Hex } from "@dustinedwards/site-runtime/encoding";
import { AppError } from "./error";

export type RoleChangeKind = "tier" | "suspend";
export type RoleValue = boolean | string;

export type RoleChange = {
  actor: string;
  target: string;
  kind: RoleChangeKind;
  from: RoleValue;
  to: RoleValue;
};

/** How long a preview stays performable. */
const CONFIRM_TTL_SECONDS = 120;

/** The shape mintConfirm signs (./signed-token): base64url payload, a dot, base64url signature. */
export const CONFIRM_TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,2048}\.[A-Za-z0-9_-]{43}$/;

/** The signing key: its own derivation from BETTER_AUTH_SECRET, so it signs nothing else. */
async function confirmKeys(secret: string | undefined): Promise<string[]> {
  if (!secret)
    throw new Error("BETTER_AUTH_SECRET is unset, so no confirmation can be signed or checked");
  return [await sha256Hex(`foxing-admin-confirm v2\n${secret}`)];
}

export async function mintConfirmation(
  secret: string | undefined,
  change: RoleChange,
): Promise<{ token: string; expiresAt: string }> {
  return mintConfirm({
    keys: await confirmKeys(secret),
    claims: change,
    ttlSeconds: CONFIRM_TTL_SECONDS,
  });
}

/**
 * Spends a token and returns the change it was minted for. Refuses one that is forged or minted for a
 * different actor, target, kind of change or new value (403), already used (409) or expired (410).
 */
export async function redeemConfirmation(
  secret: string | undefined,
  kv: KVNamespace,
  token: string,
  expected: Pick<RoleChange, "actor" | "target" | "kind" | "to">,
): Promise<RoleChange> {
  const redeemed = await redeemConfirm({
    keys: await confirmKeys(secret),
    token,
    expect: expected,
    kv,
    prefix: "admin-confirm:",
  });
  if (!redeemed.ok) throw new AppError(redeemed.status, "confirm_refused", redeemed.reason);
  return redeemed.claims as RoleChange;
}
