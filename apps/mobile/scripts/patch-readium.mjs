#!/usr/bin/env node
// Patches react-native-readium's Android EpubReaderFragment to suppress
// the system text-selection ActionMode (Copy / Translate / Select all /
// Share). Runs as the mobile package's postinstall on every install
// (local dev, EAS Build, CI).
//
// Why not pnpm patchedDependencies: EAS's frozen-lockfile install fails
// with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH whenever patchedDependencies
// is set, even with a matching lockfile entry. Their image's pnpm
// validates patches in a way that disagrees with our local pnpm.
//
// Why not patch-package: it can't resolve packages through pnpm's
// symlinked .pnpm/ store on Windows.
//
// The fix is deterministic: find the file, check the marker, rewrite
// the onCreateActionMode body. Idempotent and self-contained.

import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const MARKER = '// FOXING PATCH'
const RELATIVE_KT_PATH = join(
  'android',
  'src',
  'main',
  'java',
  'com',
  'reactnativereadium',
  'reader',
  'EpubReaderFragment.kt',
)

const PATCHED_METHOD = `        override fun onCreateActionMode(mode: ActionMode, menu: Menu): Boolean {
            // FOXING PATCH: suppress the Android system selection ActionMode
            // (Copy / Translate / Select all / Share). Returning false here
            // tells Android not to show the toolbar. Text selection itself
            // still works (highlight + drag handles are a separate WebView
            // mechanism) and onSelectionChange keeps firing so the Foxing
            // floating pill can render. The selectionActions prop in the
            // ReadiumReader wrapper needs to be non-empty for this callback
            // to install at all -- see apps/mobile/components/reader/readium-reader.tsx.
            actionIdMap.clear()
            return false
        }`

const ORIGINAL_METHOD_REGEX =
  /        override fun onCreateActionMode\(mode: ActionMode, menu: Menu\): Boolean \{[\s\S]*?\n        \}/

function resolveTargetFile() {
  // Resolve the package's installed path through require.resolve so we
  // follow pnpm's symlink into the .pnpm store. This way the write
  // lands on the canonical content-addressable file the symlink points
  // to, not a stale tree somewhere else.
  const require = createRequire(import.meta.url)
  try {
    const pkgJson = require.resolve('react-native-readium/package.json')
    return join(dirname(pkgJson), RELATIVE_KT_PATH)
  } catch (err) {
    return null
  }
}

function main() {
  const target = resolveTargetFile()
  if (!target || !existsSync(target)) {
    console.log('[patch-readium] target file not found; skipping')
    return
  }
  const contents = readFileSync(target, 'utf8')
  if (contents.includes(MARKER)) {
    console.log('Foxing patch already applied')
    return
  }
  if (!ORIGINAL_METHOD_REGEX.test(contents)) {
    console.warn(
      '[patch-readium] onCreateActionMode signature not found; skipping (upstream library may have changed shape)',
    )
    return
  }
  const next = contents.replace(ORIGINAL_METHOD_REGEX, PATCHED_METHOD)
  writeFileSync(target, next, 'utf8')
  console.log('Foxing patch applied')
}

main()
