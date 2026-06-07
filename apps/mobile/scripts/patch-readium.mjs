#!/usr/bin/env node
// Patches react-native-readium's Android EpubReaderFragment so the
// Android system text-selection ActionMode (Copy / Translate / Select
// all / Share) never renders. Runs as the mobile package's postinstall
// on every install (local dev, EAS Build, CI).
//
// Two edits, both idempotent:
//
//   1. GATE: remove the `if (selectionActions.isNotEmpty())` guard
//      around `selectionActionModeCallback = customSelectionActionModeCallback`.
//      Upstream only installs the custom callback when the RN
//      `selectionActions` prop has been pushed down before the
//      fragment's onCreate runs. On Android the WebView's long-press
//      timer (~400 ms) frequently fires before the JS bridge has
//      propagated that prop, so the default callback wins and the
//      system bar renders. Always installing the custom callback
//      sidesteps the race.
//
//   2. METHOD: rewrite the body of the custom callback's
//      `onCreateActionMode` to clear the action map and return false,
//      which tells Android not to render any ActionMode. Text
//      selection itself still works (handles / drag are a separate
//      WebView mechanism) and onSelectionChange keeps firing so the
//      Foxing floating pill is the only user-facing surface.
//
// Why not pnpm patchedDependencies: EAS's frozen-lockfile install fails
// with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH whenever patchedDependencies
// is set, even with a matching lockfile entry. Their image's pnpm
// validates patches in a way that disagrees with our local pnpm.
//
// Why not patch-package: it can't resolve packages through pnpm's
// symlinked .pnpm/ store on Windows.

import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const MARKER_METHOD = '// FOXING PATCH: suppress'
const MARKER_GATE = '// FOXING PATCH: always install'

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
            // floating pill can render.
            actionIdMap.clear()
            return false
        }`

const ORIGINAL_METHOD_REGEX =
  /        override fun onCreateActionMode\(mode: ActionMode, menu: Menu\): Boolean \{[\s\S]*?\n        \}/

const PATCHED_GATE = `              configuration = EpubNavigatorFragment.Configuration {
                // FOXING PATCH: always install the custom selection callback
                // so onCreateActionMode (returning false above) suppresses
                // the system bar even when the JS-side selectionActions
                // prop has not yet been propagated by the time the
                // WebView's long-press timer fires.
                selectionActionModeCallback = customSelectionActionModeCallback
              }`

const ORIGINAL_GATE_REGEX =
  /              configuration = EpubNavigatorFragment\.Configuration \{\s*\n\s*if \(selectionActions\.isNotEmpty\(\)\) \{\s*\n\s*selectionActionModeCallback = customSelectionActionModeCallback\s*\n\s*\}\s*\n\s*\}/

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
  let contents = readFileSync(target, 'utf8')
  const applied = []
  const skipped = []

  // Method patch
  if (contents.includes(MARKER_METHOD)) {
    skipped.push('method (already applied)')
  } else if (!ORIGINAL_METHOD_REGEX.test(contents)) {
    skipped.push('method (signature not found; upstream may have changed)')
  } else {
    contents = contents.replace(ORIGINAL_METHOD_REGEX, PATCHED_METHOD)
    applied.push('method')
  }

  // Gate patch
  if (contents.includes(MARKER_GATE)) {
    skipped.push('gate (already applied)')
  } else if (!ORIGINAL_GATE_REGEX.test(contents)) {
    skipped.push('gate (block not found; upstream may have changed)')
  } else {
    contents = contents.replace(ORIGINAL_GATE_REGEX, PATCHED_GATE)
    applied.push('gate')
  }

  if (applied.length > 0) {
    writeFileSync(target, contents, 'utf8')
    console.log(`[patch-readium] applied: ${applied.join(', ')}`)
  }
  if (skipped.length > 0) {
    console.log(`[patch-readium] skipped: ${skipped.join(', ')}`)
  }
}

main()
