// Bundles the slice of foliate-js we actually use (EPUB-only, no UI) into
// a single JSON file the app can `import` and write to FileSystem on first
// launch. Lets us ship the whole reader engine without per-platform asset
// gymnastics, Metro happily bundles JSON as a normal asset.
//
// Re-run this script any time the libs/foliate-js submodule is updated:
//   npx tsx scripts/build-foliate-bundle.ts
//
// We bundle ONLY the EPUB code path. View.js dynamically imports comic-book,
// fb2, mobi, pdf etc. but those branches never fire when we always feed it
// EPUBs, so omitting them is safe.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(SCRIPT_DIR, '..')
const FOLIATE_DIR = join(REPO_ROOT, 'libs', 'foliate-js')
const OUT_DIR = join(REPO_ROOT, 'assets', 'foliate')
const OUT_PATH = join(OUT_DIR, 'bundle.json')

// Order doesn't matter, files are written to disk before any `<script>`
// loads them. Paths here become the relative filenames inside the
// runtime directory (e.g. 'vendor/zip.js' on disk too, so foliate's own
// `import './vendor/zip.js'` resolves correctly).
const FILES = [
  'view.js',
  'epub.js',
  'epubcfi.js',
  'progress.js',
  'overlayer.js',
  'text-walker.js',
  'paginator.js',
  'fixed-layout.js',
  'vendor/zip.js',
  'vendor/fflate.js',
]

async function main() {
  const bundle: Record<string, string> = {}
  let totalBytes = 0

  for (const rel of FILES) {
    const abs = join(FOLIATE_DIR, rel)
    const content = await readFile(abs, 'utf8')
    bundle[rel] = content
    totalBytes += content.length
    console.log(`  + ${rel} (${(content.length / 1024).toFixed(1)} KB)`)
  }

  await mkdir(OUT_DIR, { recursive: true })
  // Bundle includes a `version` so foliate-assets.ts can detect when to
  // re-extract on launch (e.g. user upgraded the app and the bundle changed).
  // Bumped manually here when EITHER (a) the foliate file list/contents
  // change or (b) assets/foliate/reader.html changes, both live in the
  // same vN/ runtime directory, so a stale extraction of either keeps
  // serving old code until the version key changes.
  const payload = {
    version: 3,
    files: bundle,
  }
  await writeFile(OUT_PATH, JSON.stringify(payload), 'utf8')
  console.log(
    `\nWrote ${OUT_PATH}, ${FILES.length} files, ${(totalBytes / 1024).toFixed(1)} KB raw, ` +
      `${(((await readFile(OUT_PATH)).byteLength) / 1024).toFixed(1)} KB JSON`,
  )
}

main().catch((err) => {
  console.error('[build-foliate-bundle] fatal:', err)
  process.exit(1)
})
