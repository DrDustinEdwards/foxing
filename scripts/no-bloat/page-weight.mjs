// Page weight per route for apps/web, from a finished `pnpm build:web`.
//
// For each route in React Router's client manifest (build/client/assets/manifest-*.js)
// it sums what a first visit to that URL loads: the client entry and its imports,
// then every route from root down to this one (module, imports, manifest css), plus
// any stylesheet those modules link by URL (root links app.css through `?url`).
// Each file is counted once and gzipped with Node's zlib at level 9. Chunks loaded
// later through dynamic import() are not in the manifest and are not counted, and
// third-party stylesheets (Google Fonts) are not in the build.
//
// Compares each route with scripts/no-bloat/baseline.json and prints WARN lines for
// a route that grew by more than 5% and more than 1 KB, or is new. Report only:
// exits 1 when it warns (the CI step is continue-on-error, so the job stays green)
// and 2 when it cannot run (no build, no manifest).
//
// Usage: node scripts/no-bloat/page-weight.mjs [--json <file>]
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const CLIENT = join("apps", "web", "build", "client");
const ASSETS = join(CLIENT, "assets");
const GROWTH_RATIO = 0.05;
const GROWTH_BYTES = 1024;

function fail(message) {
  console.log(`page-weight could not run: ${message}`);
  process.exit(2);
}

if (!existsSync(ASSETS)) fail(`${ASSETS} not found; run pnpm build:web first`);
const manifestFile = readdirSync(ASSETS).find((f) => /^manifest-.*\.js$/.test(f));
if (!manifestFile) fail(`no manifest-*.js in ${ASSETS}`);
const manifestText = readFileSync(join(ASSETS, manifestFile), "utf8");
const manifest = JSON.parse(
  manifestText.slice(manifestText.indexOf("{"), manifestText.lastIndexOf("}") + 1),
);

const sizeCache = new Map();
function gz(url) {
  if (!sizeCache.has(url)) {
    const file = join(CLIENT, url.replace(/^\//, ""));
    if (!existsSync(file)) fail(`manifest names ${url}, which is not in the build`);
    const buf = readFileSync(file);
    sizeCache.set(url, { raw: buf.length, gzip: gzipSync(buf, { level: 9 }).length, text: buf });
  }
  return sizeCache.get(url);
}

function linkedCss(jsUrl) {
  const text = gz(jsUrl).text.toString("utf8");
  return [...text.matchAll(/\/assets\/[\w.-]+\.css/g)].map((m) => m[0]);
}

function chain(routeId) {
  const out = [];
  for (let id = routeId; id; id = manifest.routes[id]?.parentId) out.unshift(manifest.routes[id]);
  return out;
}

function weigh(routeId) {
  const js = new Set([manifest.entry.module, ...manifest.entry.imports]);
  const css = new Set(manifest.entry.css ?? []);
  for (const r of chain(routeId)) {
    if (r.module) js.add(r.module);
    for (const i of r.imports ?? []) js.add(i);
    for (const c of r.css ?? []) css.add(c);
  }
  for (const j of js) for (const c of linkedCss(j)) css.add(c);
  const sum = (set) => [...set].reduce((n, u) => n + gz(u).gzip, 0);
  return { js: sum(js), css: sum(css), files: js.size + css.size };
}

const routes = Object.keys(manifest.routes).filter((id) => id !== "root");
const results = routes.map((id) => {
  const path = chain(id)
    .map((x) => x.path)
    .filter(Boolean)
    .join("/");
  return { id, path: `/${path}`, ...weigh(id) };
});
results.sort((a, b) => b.js + b.css - (a.js + a.css));

const allFiles = readdirSync(ASSETS);
const totalOf = (ext) =>
  allFiles.filter((f) => f.endsWith(ext)).reduce((n, f) => n + gz(`/assets/${f}`).gzip, 0);
const totals = {
  jsFiles: allFiles.filter((f) => f.endsWith(".js")).length,
  cssFiles: allFiles.filter((f) => f.endsWith(".css")).length,
  jsGzip: totalOf(".js"),
  cssGzip: totalOf(".css"),
};

const jsonAt = process.argv.indexOf("--json");
if (jsonAt > 0) {
  const out = {
    totals,
    routes: Object.fromEntries(results.map((r) => [r.id, { js: r.js, css: r.css }])),
  };
  writeFileSync(process.argv[jsonAt + 1], `${JSON.stringify(out, null, 2)}\n`);
}

const baseline = JSON.parse(readFileSync("scripts/no-bloat/baseline.json", "utf8")).pageWeight;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const lines = [];
lines.push(
  `page-weight read: ${routes.length} routes from ${manifestFile}, ${totals.jsFiles} JS and ` +
    `${totals.cssFiles} CSS files (baseline ${Object.keys(baseline.routes).length} routes at ${baseline.commit})`,
);
lines.push(
  `page-weight all client assets: JS ${kb(totals.jsGzip)} gzip, CSS ${kb(totals.cssGzip)} gzip ` +
    `(baseline JS ${kb(baseline.totals.jsGzip)}, CSS ${kb(baseline.totals.cssGzip)})`,
);
let warned = 0;
for (const r of results) {
  const was = baseline.routes[r.id];
  const now = r.js + r.css;
  let note = "";
  if (!was) {
    note = "  WARN new route, no baseline";
    warned += 1;
  } else {
    const before = was.js + was.css;
    const delta = now - before;
    if (delta > GROWTH_BYTES && delta > before * GROWTH_RATIO) {
      note = `  WARN +${kb(delta)} over baseline ${kb(before)}`;
      warned += 1;
    } else if (delta !== 0) {
      note = `  (${delta > 0 ? "+" : ""}${(delta / 1024).toFixed(1)} KB)`;
    }
  }
  lines.push(
    `page-weight ${r.id} ${r.path}: JS ${kb(r.js)} + CSS ${kb(r.css)} gzip = ${kb(now)}${note}`,
  );
}
for (const id of Object.keys(baseline.routes)) {
  if (!manifest.routes[id]) lines.push(`page-weight ${id}: in the baseline, not in this build`);
}
lines.push(
  warned > 0
    ? `page-weight result: ${warned} route(s) over baseline (warn-only)`
    : "page-weight result: no route over baseline",
);
for (const line of lines) console.log(line);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Page weight (warn-only)\n\n\`\`\`\n${lines.join("\n")}\n\`\`\`\n\n`,
  );
}
process.exit(warned > 0 ? 1 : 0);
