#!/usr/bin/env node
// Patches react-native-readium's Android EpubReaderFragment so the system selection ActionMode never renders (postinstall, idempotent).
// Gate: always install the custom callback; upstream only does so if selectionActions arrived before onCreate, and the WebView long-press timer (~400ms) often wins that race.
// Method: onCreateActionMode clears the action map and returns false; selection and onSelectionChange still work, so the floating pill is the only surface.
// Not patch-package: a postinstall script needs no dependency and works on EAS, CI and Windows.

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const MARKER_METHOD = "// FOXING PATCH: suppress";
const MARKER_GATE = "// FOXING PATCH: always install";

const RELATIVE_KT_PATH = join(
  "android",
  "src",
  "main",
  "java",
  "com",
  "reactnativereadium",
  "reader",
  "EpubReaderFragment.kt",
);

const PATCHED_METHOD = `        override fun onCreateActionMode(mode: ActionMode, menu: Menu): Boolean {
            // FOXING PATCH: returning false suppresses the system ActionMode; selection and onSelectionChange still work.
            actionIdMap.clear()
            return false
        }`;

const ORIGINAL_METHOD_REGEX =
  /        override fun onCreateActionMode\(mode: ActionMode, menu: Menu\): Boolean \{[\s\S]*?\n        \}/;

const PATCHED_GATE = `              configuration = EpubNavigatorFragment.Configuration {
                // FOXING PATCH: always install the custom callback (the selectionActions prop may arrive after the long-press timer fires).
                selectionActionModeCallback = customSelectionActionModeCallback
              }`;

const ORIGINAL_GATE_REGEX =
  /              configuration = EpubNavigatorFragment\.Configuration \{\s*\n\s*if \(selectionActions\.isNotEmpty\(\)\) \{\s*\n\s*selectionActionModeCallback = customSelectionActionModeCallback\s*\n\s*\}\s*\n\s*\}/;

function resolveTargetFile() {
  const require = createRequire(import.meta.url);
  try {
    const pkgJson = require.resolve("react-native-readium/package.json");
    return join(dirname(pkgJson), RELATIVE_KT_PATH);
  } catch {
    return null;
  }
}

function main() {
  const target = resolveTargetFile();
  if (!target || !existsSync(target)) {
    console.log("[patch-readium] target file not found; skipping");
    return;
  }
  let contents = readFileSync(target, "utf8");
  const applied = [];
  const skipped = [];

  if (contents.includes(MARKER_METHOD)) {
    skipped.push("method (already applied)");
  } else if (!ORIGINAL_METHOD_REGEX.test(contents)) {
    skipped.push("method (signature not found; upstream may have changed)");
  } else {
    contents = contents.replace(ORIGINAL_METHOD_REGEX, PATCHED_METHOD);
    applied.push("method");
  }

  if (contents.includes(MARKER_GATE)) {
    skipped.push("gate (already applied)");
  } else if (!ORIGINAL_GATE_REGEX.test(contents)) {
    skipped.push("gate (block not found; upstream may have changed)");
  } else {
    contents = contents.replace(ORIGINAL_GATE_REGEX, PATCHED_GATE);
    applied.push("gate");
  }

  if (applied.length > 0) {
    writeFileSync(target, contents, "utf8");
    console.log(`[patch-readium] applied: ${applied.join(", ")}`);
  }
  if (skipped.length > 0) {
    console.log(`[patch-readium] skipped: ${skipped.join(", ")}`);
  }
}

main();
