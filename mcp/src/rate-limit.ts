/**
 * Rate limiting on the MCP endpoint and on /register.
 *
 * A Durable Object with the SYNCHRONOUS SQLite API, as Dustin Edwards Admin
 * measured on this account: the GA `ratelimit` binding sheds load permissively
 * under concurrency, and a Durable Object using async storage.get then
 * storage.put is not atomic across the await. `sql.exec` has no await, so the
 * read-modify-write below cannot interleave.
 *
 * A fixed window still permits up to 2x across a boundary. That is the ordinary
 * property of a fixed window, not a leak.
 */

/** Requests allowed per window, per identity. */
const LIMIT = 30;
/** Window length in seconds. */
const WINDOW_SECONDS = 60;

export class McpRateLimit implements DurableObject {
  private readonly sql: SqlStorage;

  constructor(state: DurableObjectState) {
    this.sql = state.storage.sql;
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS hits (window_start INTEGER PRIMARY KEY, count INTEGER NOT NULL)",
    );
  }

  async fetch(request: Request): Promise<Response> {
    // A caller may ask for a LOWER ceiling than LIMIT (registration does), never a higher one.
    const asked = Number(new URL(request.url).searchParams.get("limit"));
    const limit = Number.isInteger(asked) && asked >= 1 && asked < LIMIT ? asked : LIMIT;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - (now % WINDOW_SECONDS);

    const row = this.sql
      .exec<{ count: number }>(
        "INSERT INTO hits (window_start, count) VALUES (?, 1) " +
          "ON CONFLICT(window_start) DO UPDATE SET count = count + 1 " +
          "RETURNING count",
        windowStart,
      )
      .one();
    this.sql.exec("DELETE FROM hits WHERE window_start < ?", windowStart - WINDOW_SECONDS * 2);

    const allowed = row.count <= limit;
    const retryAfter = windowStart + WINDOW_SECONDS - now;
    return Response.json(
      { allowed, count: row.count, limit, retryAfter },
      {
        status: allowed ? 200 : 429,
        headers: allowed ? {} : { "retry-after": String(retryAfter) },
      },
    );
  }
}

export interface RateLimitEnv {
  MCP_RATE_LIMIT: DurableObjectNamespace;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfter: number;
}

/** Checks the limit for one identity. Fails CLOSED when the binding is absent. */
export async function checkRateLimit(
  env: Partial<RateLimitEnv>,
  identity: string,
  limit?: number,
): Promise<RateLimitDecision> {
  if (!env.MCP_RATE_LIMIT) return { allowed: false, retryAfter: WINDOW_SECONDS };
  const stub = env.MCP_RATE_LIMIT.get(env.MCP_RATE_LIMIT.idFromName(identity));
  const response = await stub.fetch(
    `https://rate-limit.invalid/check${limit ? `?limit=${limit}` : ""}`,
  );
  const body = (await response.json()) as { allowed?: boolean; retryAfter?: number };
  return {
    allowed: body.allowed === true,
    retryAfter: typeof body.retryAfter === "number" ? body.retryAfter : WINDOW_SECONDS,
  };
}
