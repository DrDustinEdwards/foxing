import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { BACKUP_EXCLUDE } from "../app/lib/backup-checks";
import { runBackup } from "../app/lib/backup.server";
import { healthResponse } from "../app/lib/health.server";

// Real D1 (with the real migrations, FTS5 tables and triggers included) and real R2, in
// Miniflare. One test per behaviour: a good run, an emptied database, a stale run, and the
// exclude list against the schema.
const workerEnv = env as unknown as Env;
const now = Date.now();

const SECRETS = [
  "SECRET-SESSION-TOKEN",
  "SECRET-OAUTH-REFRESH-TOKEN",
  "SECRET-PASSWORD-HASH",
  "SECRET-ONE-TIME-VALUE",
  "SECRET-PUSH-TOKEN",
];

async function reset() {
  await env.DB.batch(
    [
      "push_tokens",
      "session",
      "account",
      "verification",
      "annotations",
      "journal_posts",
      "profiles",
      "books",
      "user",
    ].map((t) => env.DB.prepare(`DELETE FROM "${t}"`)),
  );
  const listed = await env.BACKUPS.list();
  if (listed.objects.length > 0) await env.BACKUPS.delete(listed.objects.map((o) => o.key));
}

async function seed() {
  const s = (sql: string, ...values: unknown[]) => env.DB.prepare(sql).bind(...values);
  await env.DB.batch([
    s(
      "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES ('u1', 'Reader', 'reader@example.com', 1, ?1, ?1)",
      now,
    ),
    s(
      "INSERT INTO profiles (id, username, created_at, updated_at) VALUES ('u1', 'reader', ?1, ?1)",
      now,
    ),
    s(
      "INSERT INTO books (id, title, author, slug, source, source_type, language, created_at, updated_at) VALUES ('b1', 'Middlemarch', 'George Eliot', 'middlemarch', 'test', 'catalog', 'en', ?1, ?1)",
      now,
    ),
    s(
      "INSERT INTO annotations (id, user_id, book_id, type, selected_text, created_at, updated_at) VALUES ('a1', 'u1', 'b1', 'highlight', 'Dorothea', ?1, ?1)",
      now,
    ),
    s(
      "INSERT INTO journal_posts (id, title, slug, content, created_at, updated_at) VALUES ('j1', 'On rereading', 'on-rereading', 'Prose that exists nowhere else.', ?1, ?1)",
      now,
    ),
    s(
      "INSERT INTO session (id, expires_at, token, created_at, updated_at, user_id) VALUES ('s1', ?1, 'SECRET-SESSION-TOKEN', ?1, ?1, 'u1')",
      now,
    ),
    s(
      "INSERT INTO account (id, account_id, provider_id, user_id, refresh_token, password, created_at, updated_at) VALUES ('ac1', 'u1', 'credential', 'u1', 'SECRET-OAUTH-REFRESH-TOKEN', 'SECRET-PASSWORD-HASH', ?1, ?1)",
      now,
    ),
    s(
      "INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES ('v1', 'reset-password:x', 'SECRET-ONE-TIME-VALUE', ?1, ?1, ?1)",
      now,
    ),
    s(
      "INSERT INTO push_tokens (user_id, token, platform, created_at) VALUES ('u1', 'SECRET-PUSH-TOKEN', 'ios', ?1)",
      now,
    ),
  ]);
}

async function keys(): Promise<string[]> {
  return (await env.BACKUPS.list()).objects.map((o) => o.key);
}

async function health(at?: Date) {
  const res = await healthResponse(workerEnv, at);
  return {
    status: res.status,
    body: (await res.json()) as {
      ok: boolean;
      backup: { last_ok: string | null; age_hours: number | null; warning?: string };
    } & Record<string, unknown>,
  };
}

describe("nightly backup", () => {
  beforeEach(reset);

  it("dumps the content, leaves every credential table out, and reports a fresh age", async () => {
    await seed();
    await runBackup(workerEnv);

    const written = await keys();
    expect(written.some((k) => k.endsWith("/_complete.json"))).toBe(true);
    for (const t of ["user", "profiles", "books", "annotations", "journal_posts", "books_fts"]) {
      expect(written.some((k) => k.endsWith(`/${t}.json`))).toBe(true);
    }
    for (const t of BACKUP_EXCLUDE) {
      expect(written.some((k) => k.endsWith(`/${t}.json`))).toBe(false);
    }

    // No credential value appears in any object, and the scan read every object written.
    let read = 0;
    for (const k of written) {
      const text = (await (await env.BACKUPS.get(k))?.text()) ?? "";
      read += 1;
      for (const secret of SECRETS) expect(text).not.toContain(secret);
    }
    expect(read).toBe(written.length);
    expect(read).toBeGreaterThan(10);
    const journalKey = written.find((k) => k.endsWith("/journal_posts.json")) ?? "";
    expect(await (await env.BACKUPS.get(journalKey))?.text()).toContain(
      "Prose that exists nowhere else.",
    );

    const { status, body } = await health();
    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(["backup", "db", "ok", "time"]);
    expect(Object.keys(body.backup).sort()).toEqual(["age_hours", "last_ok"]);
    expect(body.backup.warning).toBeUndefined();
    expect(body.backup.age_hours).toBeLessThan(1);
  });

  it("leaves an emptied database without a marker, throws, and health says so", async () => {
    await expect(runBackup(workerEnv)).rejects.toThrow(
      /left incomplete: .*every counted table dumped empty/,
    );
    const written = await keys();
    expect(written.length).toBeGreaterThan(0); // the run's objects stay as evidence
    expect(written.some((k) => k.endsWith("/_complete.json"))).toBe(false);
    const { body } = await health();
    expect(body.backup.last_ok).toBeNull();
    expect(body.backup.warning).toMatch(/no complete dump/);
  });

  it("warns in health when the newest complete dump is older than 26 hours", async () => {
    await seed();
    await runBackup(workerEnv);
    const { status, body } = await health(new Date(Date.now() + 27 * 3_600_000));
    expect(status).toBe(200);
    expect(body.backup.warning).toMatch(/over the 26h threshold/);
  });

  it("excludes exactly the tables the migrated schema shows holding credentials", async () => {
    // Derived from the schema the migrations build, not from a list: a table holds a credential
    // when a column is a token, a password or a secret, or when it stores one-time values by
    // identifier with an expiry (Better Auth's verification shape: magic links, resets).
    const credentialColumn = /(^|_)(token|password|secret)$/;
    const master = await env.DB.prepare(
      "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
    ).all<{ name: string; sql: string }>();
    const virtual = master.results
      .filter((t) => /^CREATE VIRTUAL TABLE/i.test(t.sql))
      .map((t) => t.name);
    const tables = master.results
      .map((t) => t.name)
      .filter((n) => !virtual.some((v) => n === v || n.startsWith(`${v}_`)));

    const derived: string[] = [];
    for (const table of tables) {
      const cols = new Set(
        (
          await env.DB.prepare("SELECT name FROM pragma_table_info(?1)")
            .bind(table)
            .all<{ name: string }>()
        ).results.map((c) => c.name),
      );
      const oneTime = cols.has("identifier") && cols.has("value") && cols.has("expires_at");
      if (oneTime || [...cols].some((c) => credentialColumn.test(c))) derived.push(table);
    }

    expect(tables.length).toBeGreaterThan(40); // the whole schema was read
    expect(virtual.sort()).toEqual(["annotations_fts", "books_fts"]);
    const missing = derived.filter((t) => !(BACKUP_EXCLUDE as readonly string[]).includes(t));
    const extra = BACKUP_EXCLUDE.filter((t) => !derived.includes(t));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });
});
