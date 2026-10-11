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

export class ApiLegError extends Error {
  readonly kind: "unconfigured" | "unreachable" | "malformed";

  // A plain field, not a parameter property: Node runs these files by stripping
  // types only, which cannot erase a parameter property.
  constructor(message: string, kind: ApiLegError["kind"]) {
    super(message);
    this.name = "ApiLegError";
    this.kind = kind;
  }
}

export const ACTOR_HEADER = "X-Foxing-Admin-Id";
const USER_AGENT = "foxing-admin-mcp/0.1";

function assertConfigured(env: Partial<ApiEnv>): asserts env is ApiEnv {
  const unconfigured = (what: string) =>
    new ApiLegError(
      `The MCP server is not configured: ${what}. Not configured means not open.`,
      "unconfigured",
    );
  if (!env.FOXING || typeof env.FOXING.fetch !== "function") {
    throw unconfigured("the FOXING service binding is missing");
  }
  if (!env.SITE_ORIGIN) throw unconfigured("SITE_ORIGIN is unset");
  if (!env.ADMIN_OPERATOR_TOKEN || env.ADMIN_OPERATOR_TOKEN.length < 32) {
    throw unconfigured("ADMIN_OPERATOR_TOKEN is unset or shorter than 32 characters");
  }
  if (!env.FOXING_ADMIN_ID?.trim()) throw unconfigured("FOXING_ADMIN_ID is unset");
}

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
  assertConfigured(env);

  const url = new URL(`/api/v1/admin${path}`, env.SITE_ORIGIN);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const headers = new Headers({
    authorization: `Bearer ${env.ADMIN_OPERATOR_TOKEN}`,
    [ACTOR_HEADER]: env.FOXING_ADMIN_ID.trim(),
    accept: "application/json",
    "user-agent": USER_AGENT,
  });
  if (options.body) headers.set("content-type", "application/json");

  let response: Response;
  try {
    response = await env.FOXING.fetch(url.toString(), {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (cause) {
    throw new ApiLegError(
      `The Foxing admin API could not be reached: ${cause instanceof Error ? cause.message : String(cause)}`,
      "unreachable",
    );
  }

  const raw = await response.text();
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    throw new ApiLegError(
      `The Foxing admin API returned status ${response.status} with a body that is not JSON.`,
      "malformed",
    );
  }

  if (response.ok) return { status: response.status, ok: true, data: parsed };

  // The API's error envelope: { error: { code, message, details? } } (packages/api/src/error.ts).
  const envelope = (parsed as { error?: { code?: unknown; message?: unknown; details?: unknown } })
    ?.error;
  return {
    status: response.status,
    ok: false,
    error:
      typeof envelope?.message === "string"
        ? envelope.message
        : `The Foxing admin API refused with status ${response.status}.`,
    code: typeof envelope?.code === "string" ? envelope.code : undefined,
    details: envelope?.details,
  };
}
