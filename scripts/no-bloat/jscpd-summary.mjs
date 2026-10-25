// Summarizes jscpd's JSON report against the committed baseline, for the CI log.
// Run after: jscpd --baseline scripts/no-bloat/jscpd-baseline.json
// Prints how many files jscpd read, so "0 new clones" can never mean "0 files
// read" (capsid/conventions.md 3.3). Report only: exits 1 when duplication is
// above the baseline (the CI step is continue-on-error, so the job stays green), and
// throws (exit 1 with a stack) when the report is missing or unreadable.
import { appendFileSync, readFileSync } from "node:fs";

const report = JSON.parse(readFileSync(".jscpd-report/jscpd-report.json", "utf8"));
const baseline = JSON.parse(readFileSync("scripts/no-bloat/baseline.json", "utf8")).jscpd;
const total = report.statistics.total;
const pct = (n) => `${n.toFixed(2)}%`;

const lines = [];
lines.push(
  `jscpd read: ${total.sources} files, ${total.lines} lines (baseline ${baseline.sources} files, ` +
    `${baseline.lines} lines at ${baseline.commit})`,
);
lines.push(
  `jscpd duplication: ${pct(total.percentage)} of lines, ${total.clones} clones ` +
    `(baseline ${pct(baseline.percentage)}, ${baseline.clones} clones)`,
);
const fresh = report.duplicates.filter((d) => d.isNew);
lines.push(`jscpd new clones not in the baseline: ${fresh.length}`);
for (const d of fresh) {
  const a = d.firstFile;
  const b = d.secondFile;
  lines.push(
    `jscpd WARN new clone (${d.lines} lines, ${d.tokens} tokens): ` +
      `${a.name.replaceAll("\\", "/")}:${a.start}-${a.end} = ` +
      `${b.name.replaceAll("\\", "/")}:${b.start}-${b.end}`,
  );
}
const grew = total.percentage - baseline.percentage;
const warn = fresh.length > 0 || grew > 0.005;
lines.push(
  warn
    ? `jscpd result: duplication above baseline (warn-only): ${fresh.length} new clone(s), ` +
        `${grew >= 0 ? "+" : ""}${grew.toFixed(2)} points`
    : "jscpd result: no new clones and duplication not above baseline",
);
for (const line of lines) console.log(line);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### jscpd (warn-only)\n\n\`\`\`\n${lines.join("\n")}\n\`\`\`\n\n`,
  );
}
process.exitCode = warn ? 1 : 0;
