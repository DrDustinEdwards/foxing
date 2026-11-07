import { env } from "cloudflare:test";
import { resetDb } from "@dustinedwards/devkit/d1";
import { beforeEach, describe, expect, it } from "vitest";
import { BACKUP_EXCLUDE } from "../app/lib/backup-checks";
import { backupStatus, runBackup, runCoversBackup, runMediaBackup } from "../app/lib/backup.server";
import { CRON_TRIGGERS } from "../app/lib/cron-jobs";
import { operatorTools } from "../app/lib/operator.server";
import { healthResponse } from "@dustinedwards/site-runtime/health";

// Real D1 (with the real migrations, FTS5 tables and triggers included) and real R2, in
// Miniflare. One test per behavior: a good run, an emptied database and a stale run. The
// credential-column check against the schema is d1-dump's own, on in every run here.
const workerEnv = env as unknown as Env;
const now = Date.now();

// The cron's jobs marked backup, with the work the Worker gives them (workers/app.ts CRON_RUNS):
// what Capsid Admin's back up now, run_job { backup: true }, runs.
const BACKUP_RUNS: Record<string, (env: Env) => Promise<unknown>> = {
  backup: runBackup,
  "media-backup": runMediaBackup,
  "covers-backup": runCoversBackup,
};
const backupJobs = () =>
  Object.values(CRON_TRIGGERS)
    .flat()
    .filter((job) => "backup" in job && job.backup)
    .map((job) => ({ ...job, run: () => BACKUP_RUNS[job.name](workerEnv) }));

const SECRETS = [
  "SECRET-SESSION-TOKEN",
  "SECRET-OAUTH-REFRESH-TOKEN",
  "SECRET-PASSWORD-HASH",
  "SECRET-ONE-TIME-VALUE",
  "SECRET-PUSH-TOKEN",
];

async function reset() {
  await resetDb(env.DB);
  const listed = await env.BACKUPS.list();
  if (listed.objects.length > 0) await env.BACKUPS.delete(listed.objects.map((o) => o.key));
  await env.MEDIA.delete("journal/sample.png");
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
  const res = await healthResponse({
    ping: () => workerEnv.DB.prepare("SELECT 1").first(),
    backup: () => backupStatus(workerEnv, at),
    now: at,
    // Each case reads the bucket afresh; the route holds a read for five minutes per isolate.
    backupTtlMs: 0,
  });
  return {
    status: res.status,
    body: (await res.json()) as {
      ok: boolean;
      backup: {
        last_ok: string | null;
        age_hours: number | null;
        warning?: string;
        files: { age_hours: number | null; warning?: string };
      };
    } & Record<string, unknown>,
  };
}

describe("nightly backup", () => {
  beforeEach(reset);

  it("dumps the content and the Journal's pictures, leaves every credential table out, and reports a fresh age", async () => {
    await seed();
    await env.MEDIA.put("journal/sample.png", "sample bytes");
    await env.BACKUPS.put(
      "journal-media/deleted/2026-01-01T00:00:00.000Z/journal/old.png",
      "earlier bytes",
    );
    await env.MEDIA.put("reader/sample-book/chapter.xhtml", "re-derivable from the EPUB");
    // Through the operator API's run_job, the path the cron runs, recorded in cron_runs.
    const ran = (await operatorTools(workerEnv, backupJobs).run_job.run({ backup: true })) as {
      runs: { job: string; status: string }[];
    };
    expect(ran.runs.map((r) => [r.job, r.status])).toEqual([
      ["backup", "ok"],
      ["media-backup", "ok"],
      ["covers-backup", "ok"],
    ]);

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
    expect(body.backup.age_hours).toBeLessThan(1);
    expect(body.backup.warning).toBeUndefined();
    expect(body.backup.files.journal.age_hours).toBeLessThan(1);
    expect(await (await env.BACKUPS.get("files/journal/journal/sample.png"))?.text()).toBe(
      "sample bytes",
    );
    expect(
      await (
        await env.BACKUPS.get(
          "files/journal-revisions/journal-media/deleted/2026-01-01T00:00:00.000Z/journal/old.png",
        )
      )?.text(),
    ).toBe("earlier bytes");
    // The EPUBs and their reader files are fetched again, never backed up.
    expect(written.some((k) => k.includes("reader/"))).toBe(false);

    // Capsid's backup_status (the operator API) answers every files pass by its name.
    const answer = (await operatorTools(workerEnv, backupJobs).backup_status.run({})) as {
      files: Record<string, { age_hours: number }>;
    };
    expect(Object.keys(answer.files)).toEqual(["journal", "covers", "journal-revisions"]);
    expect(answer.files.covers.age_hours).toBeLessThan(1);
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
});
