// GET /health: a liveness probe for uptime monitors and the Capsid console. 200 when D1 answers
// a trivial query, 503 when it does not. Unauthenticated, so the body carries no ids, keys,
// table names or personal data: only up or down, the backup's age, and the time.
import { backupStatus } from "./backup.server";

export async function healthResponse(env: Env, now?: Date): Promise<Response> {
  let dbUp = false;
  try {
    await env.DB.prepare("SELECT 1").first();
    dbUp = true;
  } catch (err) {
    // Reported twice: the 503 below, and this log line.
    console.error(JSON.stringify({ event: "health_db_down", error: String(err) }));
  }
  // The newest complete nightly dump: { last_ok, age_hours, warning? }. A stale or unreadable
  // backup is a warning inside this field, never a 503, because the site itself is still up.
  const backup = await backupStatus(env, now);
  return new Response(
    JSON.stringify({
      ok: dbUp,
      db: dbUp ? "up" : "down",
      backup,
      time: (now ?? new Date()).toISOString(),
    }),
    {
      status: dbUp ? 200 : 503,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
