// Stage 2: explode each readable EPUB to an RWPM and upload to R2 foxing-epubs
// under reader/<slug>/. Idempotent (skips a book whose manifest.json already
// exists in R2 unless --force). Mirrors the epub migrate script's S3 pattern.
//
//   node scripts/explode-epubs/stage2-explode.ts            # full run -> R2
//   node scripts/explode-epubs/stage2-explode.ts --local    # write to out/ only
//   node scripts/explode-epubs/stage2-explode.ts --slug slocum --local
//   node scripts/explode-epubs/stage2-explode.ts --limit 20 --force
//
// R2 creds (S3 API) come from env: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import pLimit from "p-limit";
import { explodeEpub } from "./lib.ts";

const R2_ACCOUNT_ID = "f852925ce701e6c56f6feae83f0eb2d3";
const R2_BUCKET = "foxing-epubs";
const KEY_PREFIX = "reader";
const BOOK_CONCURRENCY = 6;

const args = process.argv.slice(2);
const LOCAL = args.includes("--local");
const FORCE = args.includes("--force");
const LIMIT = numArg("--limit");
const ONLY_SLUG = strArg("--slug");

const ROOT = process.cwd();
const REPORTS = resolve(ROOT, "scripts/explode-epubs/reports");
const OUT_DIR = resolve(ROOT, "scripts/explode-epubs/out");

function numArg(flag: string): number | null {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : null;
}
function strArg(flag: string): string | null {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
}

const CONTENT_TYPES: Record<string, string> = {
  xhtml: "application/xhtml+xml",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "text/javascript",
  json: "application/json",
  xml: "application/xml",
  ncx: "application/x-dtbncx+xml",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  avif: "image/avif",
  otf: "font/otf",
  ttf: "font/ttf",
  woff: "font/woff",
  woff2: "font/woff2",
};
function contentType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

const r2 =
  LOCAL
    ? null
    : new S3Client({
        region: "auto",
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
          secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
        },
      });

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name} (needed for R2 upload; use --local to write to disk instead)`);
    process.exit(1);
  }
  return v;
}

async function existsInR2(key: string): Promise<boolean> {
  if (!r2) return false;
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function putR2(key: string, body: Buffer, type: string): Promise<void> {
  if (!r2) return;
  await r2.send(
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: body, ContentType: type }),
  );
}

function putLocal(slug: string, relPath: string, body: Buffer): void {
  const dest = join(OUT_DIR, slug, relPath);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, body);
}

interface Book {
  slug: string;
  epubUrl: string;
}
type Result =
  | { slug: string; status: "ok" | "skipped"; objects: number; stats?: unknown }
  | { slug: string; status: "failed"; error: string };

async function processBook(book: Book): Promise<Result> {
  const { slug, epubUrl } = book;
  const manifestKey = `${KEY_PREFIX}/${slug}/manifest.json`;

  if (!FORCE && (await existsInR2(manifestKey))) {
    return { slug, status: "skipped", objects: 0 };
  }

  let buf: Buffer;
  try {
    const res = await fetch(epubUrl);
    if (!res.ok) throw new Error(`download ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    return { slug, status: "failed", error: `download: ${(e as Error).message}` };
  }

  try {
    const { manifest, positionList, files, stats } = await explodeEpub(buf);
    const manifestBuf = Buffer.from(JSON.stringify(manifest));
    const positionBuf = Buffer.from(JSON.stringify(positionList));

    if (LOCAL) {
      putLocal(slug, "manifest.json", manifestBuf);
      putLocal(slug, "position-list.json", positionBuf);
      for (const [path, body] of files) putLocal(slug, path, body);
    } else {
      // Resources first, manifest LAST so its presence signals a complete book
      // (the idempotency check keys on manifest.json).
      const uploads: Array<Promise<void>> = [];
      for (const [path, body] of files) {
        uploads.push(putR2(`${KEY_PREFIX}/${slug}/${path}`, body, contentType(path)));
      }
      const fileLimit = pLimit(12);
      await Promise.all(uploads.map((u) => fileLimit(() => u)));
      await putR2(`${KEY_PREFIX}/${slug}/position-list.json`, positionBuf, "application/json");
      await putR2(manifestKey, manifestBuf, "application/webpub+json");
    }

    return { slug, status: "ok", objects: files.size + 2, stats };
  } catch (e) {
    return { slug, status: "failed", error: `explode: ${(e as Error).message}` };
  }
}

async function main() {
  let work = JSON.parse(readFileSync(resolve(REPORTS, "work.json"), "utf-8")) as Book[];
  if (ONLY_SLUG) work = work.filter((b) => b.slug === ONLY_SLUG);
  if (LIMIT) work = work.slice(0, LIMIT);

  console.log(
    `[stage2] ${work.length} books | target=${LOCAL ? "local out/" : `R2 ${R2_BUCKET}/${KEY_PREFIX}`} | force=${FORCE}`,
  );

  const limit = pLimit(BOOK_CONCURRENCY);
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  let objects = 0;
  const errors: Array<{ slug: string; error: string }> = [];
  let done = 0;

  await Promise.all(
    work.map((book) =>
      limit(async () => {
        const r = await processBook(book);
        done++;
        if (r.status === "ok") {
          ok++;
          objects += r.objects;
        } else if (r.status === "skipped") {
          skipped++;
        } else {
          failed++;
          errors.push({ slug: r.slug, error: r.error });
          console.error(`  FAILED ${r.slug}: ${r.error}`);
        }
        if (done % 25 === 0 || done === work.length) {
          console.log(`  ${done}/${work.length} ok=${ok} skipped=${skipped} failed=${failed}`);
        }
      }),
    ),
  );

  mkdirSync(REPORTS, { recursive: true });
  writeFileSync(
    resolve(REPORTS, "explode-report.json"),
    JSON.stringify({ ok, skipped, failed, objects, errors }, null, 2),
  );
  console.log(`\n[stage2] done: ok=${ok} skipped=${skipped} failed=${failed} objects~=${objects}`);
  if (errors.length) console.log(`[stage2] ${errors.length} failures in reports/explode-report.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
