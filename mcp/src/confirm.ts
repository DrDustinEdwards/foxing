/**
 * THE CONFIRMATION STEP for the tools that overwrite or publish (checklist T11: an irreversible action needs the
 * administrator's confirmation tied to that exact action).
 *
 * A write tool called without `confirm` changes nothing. It answers with a preview of exactly what it would send and a
 * token: an HMAC over the tool's name, an expiry and its arguments (`confirm` aside), keyed from the operator token
 * this Worker already holds, so nothing is stored and no new secret is needed. The same call with that token, within
 * ten minutes, runs it. Any other argument, another tool or an old token is refused and sends nothing.
 *
 * Works on every client, unlike elicitation, which most connectors do not offer yet. The token proves the preview was
 * produced for these arguments; the tool's text asks the model to show it to the administrator and wait for a yes.
 */

const TTL_MS = 10 * 60_000;
const LABEL = "foxing-admin-mcp confirm v1";

export type ConfirmEnv = { ADMIN_OPERATOR_TOKEN?: string };

/** JSON with every object's keys sorted, so the same arguments always sign the same bytes. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function sign(env: ConfirmEnv, tool: string, expires: number, args: Record<string, unknown>): Promise<string | null> {
  const secret = env.ADMIN_OPERATOR_TOKEN;
  if (typeof secret !== "string" || secret.length < 32) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(`${LABEL}\n${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const { confirm: _ignored, ...rest } = args;
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${tool}\n${expires}\n${canonical(rest)}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A token for exactly this call, or null when the Worker has no operator token to key it with. */
export async function confirmationFor(env: ConfirmEnv, tool: string, args: Record<string, unknown>, now = Date.now()) {
  const expires = now + TTL_MS;
  const mac = await sign(env, tool, expires, args);
  return mac ? { token: `${expires.toString(36)}.${mac}`, expiresAt: new Date(expires).toISOString() } : null;
}

/** Whether `token` was issued for exactly this tool and these arguments, and is still fresh. */
export async function isConfirmed(env: ConfirmEnv, tool: string, args: Record<string, unknown>, token: string, now = Date.now()): Promise<boolean> {
  const match = /^([0-9a-z]{1,12})\.([0-9a-f]{64})$/.exec(token);
  if (!match) return false;
  const expires = Number.parseInt(match[1], 36);
  if (!Number.isFinite(expires) || expires < now || expires > now + TTL_MS) return false;
  const expected = await sign(env, tool, expires, args);
  if (!expected) return false;
  // Constant time over equal-length hex.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ match[2].charCodeAt(i);
  return diff === 0;
}
