/**
 * The API leg: authenticated HTTP to /api/v1/admin/* on the `foxing` Worker over the FOXING service binding (still HTTP, so the
 * same middleware runs). The admin API owns every rule; nothing here interprets one. ADMIN_OPERATOR_TOKEN identifies what this
 * Worker may do; it is never the client's OAuth token (no token passthrough).
 */

import { ApiLegError, callApi } from "@dustinedwards/site-runtime/mcp-server";
import { readProblem } from "@dustinedwards/site-runtime/http-errors";

export interface ApiEnv {
  FOXING: Fetcher;
  /** The URL the bound Worker sees. A service binding ignores the host; the app reads its own URL. */
  SITE_ORIGIN: string;
  ADMIN_OPERATOR_TOKEN: string;
  FOXING_ADMIN_ID: string;
}

export interface ApiCallResult {
  status: number;
  ok: boolean;
  data?: unknown;
  /** On failure, the API's message VERBATIM. Never summarized or softened. */
  error?: string;
  code?: string;
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

/** One request to the admin API (`path` under /api/v1/admin). The API's JSON comes back as sent. */
export async function callAdmin(
  env: Partial<ApiEnv>,
  method: "GET" | "POST" | "PATCH",
  path: string,
  options: { query?: Query; body?: Record<string, unknown>; signal?: AbortSignal } = {},
): Promise<ApiCallResult> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) query.set(key, String(value));
  }
  const { status, ok, body } = await callApi(
    env,
    LEG,
    `/api/v1/admin${path}${query.size ? `?${query}` : ""}`,
    {
      method,
      headers: { [ACTOR_HEADER]: env.FOXING_ADMIN_ID?.trim() ?? "" },
      json: options.body,
      // The call's abort signal (checklist P11): a client that closes the stream stops the request to the API.
      signal: options.signal,
    },
  );
  if (ok) return { status, ok: true, data: body };

  const problem = readProblem(body, `The Foxing admin API refused with status ${status}.`);
  return {
    status,
    ok: false,
    error: problem.detail,
    code: problem.code === "http_error" ? undefined : problem.code,
    details: Object.keys(problem.extensions).length ? problem.extensions : undefined,
  };
}
