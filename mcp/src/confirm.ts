/**
 * THE CONFIRMATION STEP for the tools that overwrite or publish (checklist T11: an irreversible action needs the
 * administrator's confirmation tied to that exact action).
 *
 * A write tool called without `confirm` changes nothing. It answers with a preview of exactly what it would send and a
 * token from site-runtime ./confirm-token: signed claims naming the tool and its arguments (`confirm` aside), with an
 * expiry, keyed from the operator token this Worker already holds, so nothing is stored and no new secret is needed.
 * The same call with that token, within ten minutes, runs it. Any other argument, another tool or an old token is
 * refused and sends nothing.
 *
 * Works on every client, unlike elicitation, which most connectors do not offer yet. The token proves the preview was
 * produced for these arguments; the tool's text asks the model to show it to the administrator and wait for a yes.
 */

import { mintConfirm, redeemConfirm } from "@dustinedwards/site-runtime/confirm-token";
import { canonicalJson, sha256Hex } from "@dustinedwards/site-runtime/encoding";

const TTL_SECONDS = 10 * 60;
const LABEL = "foxing-admin-mcp confirm v2";

export type ConfirmEnv = { ADMIN_OPERATOR_TOKEN?: string };

/** The signing key, derived from the operator token; null when the Worker has none worth keying with. */
async function keys(env: ConfirmEnv): Promise<string[] | null> {
  const secret = env.ADMIN_OPERATOR_TOKEN;
  if (typeof secret !== "string" || secret.length < 32) return null;
  return [await sha256Hex(`${LABEL}\n${secret}`)];
}

/** The claims a token is bound to: the tool and its arguments, `confirm` aside, as canonical JSON. */
function bound(tool: string, args: Record<string, unknown>) {
  const { confirm: _ignored, ...rest } = args;
  return { tool, args: canonicalJson(rest) };
}

/** A token for exactly this call, or null when the Worker has no operator token to key it with. */
export async function confirmationFor(
  env: ConfirmEnv,
  tool: string,
  args: Record<string, unknown>,
  now = Date.now(),
) {
  const k = await keys(env);
  if (!k) return null;
  return mintConfirm({ keys: k, claims: bound(tool, args), ttlSeconds: TTL_SECONDS, now });
}

/** Whether `token` was issued for exactly this tool and these arguments, and is still fresh. */
export async function isConfirmed(
  env: ConfirmEnv,
  tool: string,
  args: Record<string, unknown>,
  token: string,
  now = Date.now(),
): Promise<boolean> {
  const k = await keys(env);
  if (!k) return false;
  return (await redeemConfirm({ keys: k, token, expect: bound(tool, args), now })).ok;
}
