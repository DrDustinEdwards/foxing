// Knip preprocessor: a name on the improve/holdout imports list counts as used.
//
// capsid/conventions.md 3.6: dead code means no caller in src or tests and no
// entry in improve/holdout/<namespace>/imports.txt. The hidden holdout suite
// imports those names, and nothing in this repo can see it, so Knip cannot either.
// This drops any unused-export finding whose name is on a list and says how many
// it dropped, so the report never hides that it did.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const EXPORT_TYPES = ["exports", "nsExports", "types", "nsTypes"];

function readHoldoutNames(cwd) {
  const root = join(cwd, "improve", "holdout");
  let namespaces;
  try {
    namespaces = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
  } catch (error) {
    if (error.code === "ENOENT") return { names: new Set(), files: [] };
    throw error;
  }
  const names = new Set();
  const files = [];
  for (const ns of namespaces) {
    const file = join(root, ns.name, "imports.txt");
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    files.push(`improve/holdout/${ns.name}/imports.txt`);
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (line && !line.startsWith("#")) names.add(line);
    }
  }
  return { names, files };
}

export default function holdout(options) {
  const { names, files } = readHoldoutNames(options.cwd);
  const kept = [];
  for (const type of EXPORT_TYPES) {
    const byFile = options.issues[type];
    if (!byFile) continue;
    for (const [file, bySymbol] of Object.entries(byFile)) {
      for (const symbol of Object.keys(bySymbol)) {
        if (!names.has(symbol)) continue;
        delete bySymbol[symbol];
        options.counters[type] -= 1;
        kept.push(`${file}: ${symbol}`);
      }
      if (Object.keys(bySymbol).length === 0) delete byFile[file];
    }
  }
  console.log(
    `knip holdout: ${names.size} names read from ${files.length} list(s)` +
      `${files.length ? ` (${files.join(", ")})` : ""}; ${kept.length} finding(s) treated as used`,
  );
  for (const line of kept) console.log(`knip holdout: kept ${line}`);
  return options;
}
