// Knip reporter: one summary block for the CI log, with the count of files Knip
// read, so "0 findings" can never mean "0 files read" (capsid/conventions.md 3.3).
// Compares each count with scripts/no-bloat/baseline.json. Report only. Run Knip
// with --no-exit-code and this reporter last; it sets the exit code instead: 1 when
// a category is above the baseline, 2 when a plugin config failed to load (a check
// that could not fully run). The CI step is continue-on-error, so neither turns the
// job red.
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROWS = [
  ["files", "unused files"],
  ["dependencies", "unused dependencies"],
  ["devDependencies", "unused devDependencies"],
  ["unlisted", "unlisted dependencies"],
  ["unresolved", "unresolved imports"],
  ["binaries", "unlisted binaries"],
  ["exports", "unused exports"],
  ["types", "unused exported types"],
  ["nsExports", "unused namespace exports"],
  ["nsTypes", "unused namespace types"],
  ["enumMembers", "unused enum members"],
  ["namespaceMembers", "unused namespace members"],
  ["duplicates", "duplicate exports"],
];

export default function summary(options) {
  const { counters, cwd } = options;
  const baseline = JSON.parse(
    readFileSync(join(cwd, "scripts", "no-bloat", "baseline.json"), "utf8"),
  ).knip;
  const lines = [];
  lines.push(
    `knip read: ${counters.processed} of ${counters.total} project files in ` +
      `${options.includedWorkspaceDirs.length} workspaces (baseline commit ${baseline.commit})`,
  );
  if (options.hasConfigLoadErrors) {
    lines.push("knip warning: a plugin config failed to load; see the errors above");
  }
  let grew = 0;
  for (const [key, label] of ROWS) {
    const now = counters[key] ?? 0;
    const was = baseline.counts[key] ?? 0;
    const delta = now - was;
    if (delta > 0) grew += 1;
    const mark = delta > 0 ? `  WARN +${delta} over baseline` : delta < 0 ? `  (${delta})` : "";
    lines.push(`knip ${label}: ${now} (baseline ${was})${mark}`);
  }
  lines.push(
    grew > 0
      ? `knip result: ${grew} categor${grew === 1 ? "y" : "ies"} above baseline (warn-only)`
      : "knip result: no category above baseline",
  );
  for (const line of lines) console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Knip (warn-only)\n\n\`\`\`\n${lines.join("\n")}\n\`\`\`\n\n`,
    );
  }
  // Knip's --no-exit-code ends the process with 0 after the reporters return, so
  // a process.exitCode set here is overwritten. This reporter goes last on the
  // command line and exits itself.
  process.exit(options.hasConfigLoadErrors ? 2 : grew > 0 ? 1 : 0);
}
