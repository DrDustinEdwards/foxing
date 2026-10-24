// Stage 1: list readable catalog books (slug + epub_url) from D1 into
// reports/work.json. Readable = source_type='catalog' AND epub_url present.
// Uses wrangler d1 execute --remote --json (same auth as the import pipeline).
// Run: node scripts/explode-epubs/stage1-list.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const WEB_DIR = resolve(process.cwd(), "apps/web");
const OUT_DIR = resolve(process.cwd(), "scripts/explode-epubs/reports");
const D1_DB = "foxing";

const SQL =
  "SELECT slug, epub_url FROM books WHERE source_type='catalog' AND epub_url IS NOT NULL AND slug IS NOT NULL ORDER BY slug;";

function d1Query(sql: string): Array<Record<string, unknown>> {
  // --file returns only metadata, not rows, so use --command. Pass the whole
  // invocation as one shell string (shell:true is required for pnpm.cmd on
  // Windows); the SQL is double-quoted so cmd.exe keeps it as one argument and
  // the inner single quotes stay literal. The SQL here is a fixed literal (no
  // user input), so the lack of escaping is not a concern.
  const cmd = `pnpm exec wrangler d1 execute ${D1_DB} --remote --json --command "${sql}"`;
  const proc = spawnSync(cmd, {
    cwd: WEB_DIR,
    encoding: "utf-8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (proc.status !== 0) {
    throw new Error(`wrangler d1 execute failed: ${proc.stderr || proc.stdout}`);
  }
  // wrangler prints a JSON array: [{ results: [...], success, meta }]. It may be
  // preceded by non-JSON log lines, so slice from the first '['.
  const out = proc.stdout;
  const start = out.indexOf("[");
  if (start < 0) throw new Error(`no JSON in wrangler output: ${out.slice(0, 200)}`);
  const parsed = JSON.parse(out.slice(start)) as Array<{ results: Array<Record<string, unknown>> }>;
  return parsed[0]?.results ?? [];
}

function main() {
  console.log("[stage1] querying D1 for readable catalog books...");
  const rows = d1Query(SQL);
  const work = rows
    .map((r) => ({ slug: String(r.slug), epubUrl: String(r.epub_url) }))
    .filter((r) => r.slug && r.epubUrl.startsWith("http"));

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, "work.json"), JSON.stringify(work, null, 2));
  console.log(`[stage1] wrote ${work.length} books to reports/work.json`);
}

main();
