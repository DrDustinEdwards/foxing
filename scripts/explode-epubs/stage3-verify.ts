// Stage 3: verify the explode run. Counts manifests present in R2 vs the work
// list, sample-parses manifests + position lists, and (when --base is given)
// confirms the served asset path returns X-Robots-Tag: noindex (R3).
//
//   pnpm tsx scripts/explode-epubs/stage3-verify.ts
//   pnpm tsx scripts/explode-epubs/stage3-verify.ts --base https://foxing.dustin-edwards.workers.dev
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import pLimit from "p-limit";

const R2_ACCOUNT_ID = "f852925ce701e6c56f6feae83f0eb2d3";
const R2_BUCKET = "foxing-epubs";
const KEY_PREFIX = "reader";
const SAMPLE = 8;

const args = process.argv.slice(2);
const BASE = (() => {
  const i = args.indexOf("--base");
  return i >= 0 ? args[i + 1] : null;
})();
const REPORTS = resolve(process.cwd(), "scripts/explode-epubs/reports");

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env("R2_ACCESS_KEY_ID"),
    secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
  },
});
function env(n: string): string {
  const v = process.env[n];
  if (!v) {
    console.error(`Missing ${n}`);
    process.exit(1);
  }
  return v;
}

async function head(key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}
async function getJson(key: string): Promise<unknown> {
  const res = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  return JSON.parse((await res.Body?.transformToString()) ?? "null");
}

async function main() {
  const work = JSON.parse(readFileSync(resolve(REPORTS, "work.json"), "utf-8")) as Array<{
    slug: string;
  }>;
  console.log(`[stage3] verifying ${work.length} books`);

  const limit = pLimit(12);
  let present = 0;
  const missing: string[] = [];
  await Promise.all(
    work.map((b) =>
      limit(async () => {
        if (await head(`${KEY_PREFIX}/${b.slug}/manifest.json`)) present++;
        else missing.push(b.slug);
      }),
    ),
  );
  console.log(`[stage3] manifests present: ${present}/${work.length}, missing: ${missing.length}`);
  if (missing.length) console.log(`  first missing: ${missing.slice(0, 10).join(", ")}`);

  // Sample-parse manifests + position lists.
  const sample = work.slice(0, SAMPLE);
  for (const b of sample) {
    try {
      const m = (await getJson(`${KEY_PREFIX}/${b.slug}/manifest.json`)) as {
        readingOrder?: unknown[];
        links?: Array<{ rel?: string[] }>;
      };
      const pl = (await getJson(`${KEY_PREFIX}/${b.slug}/position-list.json`)) as {
        total?: number;
      };
      const hasPosLink = (m.links ?? []).some((l) => (l.rel ?? []).includes("position-list"));
      console.log(
        `  ${b.slug}: readingOrder=${m.readingOrder?.length ?? 0} positions=${pl.total ?? 0} posLink=${hasPosLink}`,
      );
    } catch (e) {
      console.log(`  ${b.slug}: SAMPLE FAILED ${(e as Error).message}`);
    }
  }

  // Served noindex check (R3).
  if (BASE) {
    const url = `${BASE}/reader-assets/${sample[0].slug}/manifest.json`;
    const res = await fetch(url);
    const xrt = res.headers.get("x-robots-tag");
    console.log(`[stage3] served ${url} -> ${res.status}, X-Robots-Tag: ${xrt ?? "(none)"}`);
    if (!xrt?.includes("noindex")) console.error("[stage3] WARNING: served asset is not noindex");
  } else {
    console.log("[stage3] pass --base <url> to verify served X-Robots-Tag: noindex");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
