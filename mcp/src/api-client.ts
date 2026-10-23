/**
 * The API LEG: this Worker to foxing.app.
 *
 * The ONLY way this Worker reaches Foxing's data: authenticated HTTP to
 * /api/v1/admin/* on the `foxing` Worker over the FOXING service binding. The
 * admin API owns every rule (packages/api/src/routes/admin.ts): it resolves the
 * operator bearer to the acting admin named in X-Foxing-Admin-Id
 * (packages/api/src/middleware/operator.ts), re-reads that account's is_admin
 * and suspension from D1 on every request, validates the input, writes the
 * admin_audit_log and rate limits. Nothing here interprets a rule.
 *
 * A service binding is still HTTP, not an in-process call: the request crosses
 * the same middleware any other admin request does.
 *
 * The credential here, ADMIN_OPERATOR_TOKEN, identifies WHAT this Worker may
 * do. It is never the client's OAuth token (no token passthrough, rule 12.2).
 */

import { ApiLegError, callApi } from "@dustinedwards/site-runtime/mcp-server";

export interface ApiEnv {
  /** Service binding to the `foxing` Worker. The only route to the app. */
  FOXING: Fetcher;
  /** The URL the bound Worker sees. A service binding ignores the host; the app reads its own URL. */
  SITE_ORIGIN: string;
  /** The API leg bearer. Same value as the foxing Worker's ADMIN_OPERATOR_TOKEN secret. */
  ADMIN_OPERATOR_TOKEN: string;
  /** The Foxing user id of the acting admin, sent as X-Foxing-Admin-Id and re-checked by the API. */
  FOXING_ADMIN_ID: string;
}

export interface ApiCallResult {
  /** HTTP status the API returned. */
  status: number;
  /** True for a 2xx answer with a JSON body. */
  ok: boolean;
  /** On success, the API's JSON body. */
  data?: unknown;
  /** On failure, the API's message VERBATIM. Never summarized or softened. */
  error?: string;
  /** On failure, the API's error code (forbidden, validation, not_found, ...). */
  code?: string;
  /** On failure, the API's structured details (a validation failure names each field). */
  details?: unknown;
}

export { ApiLegError };

export const ACTOR_HEADER = "X-Foxing-Admin-Id";
const LEG = {
  binding: "FOXING",
  token: "ADMIN_OPERATOR_TOKEN",
  api: "The Foxing admin API",
  userAgent: "foxing-admin-mcp/0.1",
  require: ["FOXING_ADMIN_ID"],
};

export type Query = Record<string, string | number | undefined>;

/**
 * One request to the admin API. `path` is under /api/v1/admin, e.g. "/users".
 * A transport, not a translator: the API's JSON comes back as it was sent.
 */
export async function callAdmin(
  env: Partial<ApiEnv>,
  method: "GET" | "POST" | "PATCH",
  path: string,
  options: { query?: Query; body?: Record<string, unknown> } = {},
): Promise<ApiCallResult> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) query.set(key, String(value));
  }
  const { status, ok, body } = await callApi(env, LEG, `/api/v1/admin${path}${query.size ? `?${query}` : ""}`, {
    method,
    headers: { [ACTOR_HEADER]: env.FOXING_ADMIN_ID?.trim() ?? "" },
    json: options.body,
  });
  if (ok) return { status, ok: true, data: body };

  // The API's error envelope: { error: { code, message, details? } } (packages/api/src/error.ts).
  const envelope = (body as { error?: { code?: unknown; message?: unknown; details?: unknown } })?.error;
  return {
    status,
    ok: false,
    error: typeof envelope?.message === "string" ? envelope.message : `The Foxing admin API refused with status ${status}.`,
    code: typeof envelope?.code === "string" ? envelope.code : undefined,
    details: envelope?.details,
  };
}
