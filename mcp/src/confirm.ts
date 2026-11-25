/**
 * The confirmation step for tools that overwrite or publish. Without `confirm` a write tool changes nothing: it answers with a preview and a
 * token from site-runtime ./confirm-token (signed claims naming the tool and a fingerprint of its arguments, keyed from the operator token, so
 * nothing is stored). The same call with that token, within ten minutes, runs once (spent in KV when there is one); any other argument, tool or
 * an old token is refused. Works on every client, unlike elicitation.
 */

import { mintConfirm, redeemConfirm } from "@dustinedwards/site-runtime/confirm-token";
import { canonicalJson, sha256Hex } from "@dustinedwards/site-runtime/encoding";

const TTL_SECONDS = 10 * 60;
const LABEL = "foxing-admin-mcp confirm v2";

export type ConfirmEnv = {
  ADMIN_OPERATOR_TOKEN?: string;
  /** When present a token is spent on its first use, so a retried or replayed call cannot run twice. */
  OAUTH_KV?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  };
};

async function keys(env: ConfirmEnv): Promise<string[] | null> {
  const secret = env.ADMIN_OPERATOR_TOKEN;
  if (typeof secret !== "string" || secret.length < 32) return null;
  return [await sha256Hex(`${LABEL}\n${secret}`)];
}

/** The claims a token binds: the tool and a fingerprint of its arguments, so a token stays short however long the edit is. */
async function bound(tool: string, args: Record<string, unknown>) {
  const { confirm: _ignored, ...rest } = args;
  return { tool, args: await sha256Hex(canonicalJson(rest)) };
}

export async function confirmationFor(
  env: ConfirmEnv,
  tool: string,
  args: Record<string, unknown>,
  now = Date.now(),
) {
  const k = await keys(env);
  if (!k) return null;
  return mintConfirm({ keys: k, claims: await bound(tool, args), ttlSeconds: TTL_SECONDS, now });
}

export async function isConfirmed(
  env: ConfirmEnv,
  tool: string,
  args: Record<string, unknown>,
  token: string,
  now = Date.now(),
): Promise<boolean> {
  const k = await keys(env);
  if (!k) return false;
  const kv = env.OAUTH_KV;
  const expect = await bound(tool, args);
  return (
    await redeemConfirm({
      keys: k,
      token,
      expect,
      now,
      ...(kv ? { kv, prefix: "foxing-mcp-confirm:" } : {}),
    })
  ).ok;
}
