/**
 * Structural bloat audit for the Foxing monorepo.
 *
 * Scans apps/web and apps/mobile for structural smells that bloat component
 * and route files without adding behavior:
 *   - Inline JSX assigned to consts (extractable into their own components)
 *   - .map/.filter data reshaping inside route/component files (belongs in lib/)
 *   - Nested ternaries of depth >= 2 (extractable into early-return components)
 *   - Oversized component/file bodies (lines, JSX return size)
 *
 * Emits bloat-report.md ranked by a weighted score. Read-only.
 */
import { Project, SyntaxKind, Node } from "ts-morph";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const TARGET_GLOBS = [
  "apps/web/app/**/*.tsx",
  "apps/web/components/**/*.tsx",
  "apps/mobile/app/**/*.tsx",
  "apps/mobile/components/**/*.tsx",
  "apps/mobile/src/**/*.tsx",
];

type Finding = {
  file: string;
  lines: number;
  inlineJsxConsts: { name: string; line: number }[];
  reshapeOps: { line: number; kind: string }[];
  nestedTernaries: { line: number; depth: number }[];
  bigJsxReturns: { line: number; size: number }[];
  score: number;
};

function relabel(filePath: string): string {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

const project = new Project({
  tsConfigFilePath: undefined,
  skipAddingFilesFromTsConfig: true,
  compilerOptions: { allowJs: false, jsx: 4 as any },
});

for (const g of TARGET_GLOBS) {
  project.addSourceFilesAtPaths(path.join(ROOT, g).replace(/\\/g, "/"));
}

function jsxNodeSize(node: Node): number {
  // approximate rendered markup size by line span
  return node.getEndLineNumber() - node.getStartLineNumber() + 1;
}

function isJsxLike(node: Node | undefined): boolean {
  if (!node) return false;
  const k = node.getKind();
  return (
    k === SyntaxKind.JsxElement ||
    k === SyntaxKind.JsxFragment ||
    k === SyntaxKind.JsxSelfClosingElement
  );
}

// depth of chained conditional expressions in either branch
function ternaryDepth(node: Node): number {
  if (node.getKind() !== SyntaxKind.ConditionalExpression) return 0;
  const cond = node.asKindOrThrow(SyntaxKind.ConditionalExpression);
  const whenTrue = cond.getWhenTrue();
  const whenFalse = cond.getWhenFalse();
  const childDepth = Math.max(
    ternaryDepth(whenTrue),
    ternaryDepth(whenFalse)
  );
  return 1 + childDepth;
}

const findings: Finding[] = [];

for (const sf of project.getSourceFiles()) {
  const filePath = sf.getFilePath();
  if (filePath.includes("node_modules")) continue;
  if (/\.(test|spec|stories)\.tsx$/.test(filePath)) continue;

  const lines = sf.getEndLineNumber();
  const f: Finding = {
    file: relabel(filePath),
    lines,
    inlineJsxConsts: [],
    reshapeOps: [],
    nestedTernaries: [],
    bigJsxReturns: [],
    score: 0,
  };

  // Inline JSX assigned to consts at non-trivial size
  sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach((decl) => {
    const init = decl.getInitializer();
    if (!init) return;
    let jsx: Node | undefined;
    if (isJsxLike(init)) jsx = init;
    else if (init.getKind() === SyntaxKind.ParenthesizedExpression) {
      const inner = init.asKindOrThrow(SyntaxKind.ParenthesizedExpression).getExpression();
      if (isJsxLike(inner)) jsx = inner;
    }
    if (jsx && jsxNodeSize(jsx) >= 4) {
      f.inlineJsxConsts.push({
        name: decl.getName(),
        line: decl.getStartLineNumber(),
      });
    }
  });

  // .map / .filter reshaping (chained transforms producing new objects)
  sf.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((call) => {
    const expr = call.getExpression();
    if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return;
    const pae = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
    const name = pae.getName();
    if (name !== "map" && name !== "filter") return;
    // Heuristic: reshaping = callback returns an object literal / spread,
    // or the call is itself chained off another map/filter.
    const arg = call.getArguments()[0];
    let reshaping = false;
    if (arg && (Node.isArrowFunction(arg) || Node.isFunctionExpression(arg))) {
      const body = arg.getBody();
      const txt = body.getText();
      if (/=>\s*\(?\s*\{/.test(arg.getText()) || /return\s*\{/.test(txt) || /\.\.\./.test(txt)) {
        reshaping = true;
      }
    }
    const inner = pae.getExpression();
    if (inner.getKind() === SyntaxKind.CallExpression) {
      const innerExpr = inner.asKindOrThrow(SyntaxKind.CallExpression).getExpression();
      if (innerExpr.getKind() === SyntaxKind.PropertyAccessExpression) {
        const innerName = innerExpr.asKindOrThrow(SyntaxKind.PropertyAccessExpression).getName();
        if (innerName === "map" || innerName === "filter") reshaping = true;
      }
    }
    if (reshaping) {
      f.reshapeOps.push({ line: call.getStartLineNumber(), kind: name });
    }
  });

  // Nested ternaries depth >= 2
  sf.getDescendantsOfKind(SyntaxKind.ConditionalExpression).forEach((cond) => {
    // only count outermost (skip if parent is also a conditional branch)
    const parent = cond.getParent();
    if (parent && parent.getKind() === SyntaxKind.ConditionalExpression) return;
    const d = ternaryDepth(cond);
    if (d >= 2) {
      f.nestedTernaries.push({ line: cond.getStartLineNumber(), depth: d });
    }
  });

  // Big JSX returns in component functions
  sf.getDescendantsOfKind(SyntaxKind.ReturnStatement).forEach((ret) => {
    const child = ret.getExpression();
    let jsx: Node | undefined;
    if (isJsxLike(child)) jsx = child;
    else if (child && child.getKind() === SyntaxKind.ParenthesizedExpression) {
      const inner = child.asKindOrThrow(SyntaxKind.ParenthesizedExpression).getExpression();
      if (isJsxLike(inner)) jsx = inner;
    }
    if (jsx) {
      const size = jsxNodeSize(jsx);
      if (size >= 80) f.bigJsxReturns.push({ line: ret.getStartLineNumber(), size });
    }
  });

  f.score =
    f.inlineJsxConsts.length * 8 +
    f.reshapeOps.length * 6 +
    f.nestedTernaries.reduce((s, t) => s + t.depth * 5, 0) +
    f.bigJsxReturns.reduce((s, b) => s + Math.floor(b.size / 20), 0) +
    Math.floor(lines / 100);

  if (f.score > 0) findings.push(f);
}

findings.sort((a, b) => b.score - a.score);

const out: string[] = [];
out.push("# Structural Bloat Report");
out.push("");
out.push(`Generated over ${project.getSourceFiles().length} source files.`);
out.push("");
out.push("Ranked by weighted score. Higher = more structural bloat.");
out.push("");
out.push("| Rank | Score | File | Lines | InlineJSX | Reshape | NestedTern | BigJSX |");
out.push("| ---: | ----: | ---- | ----: | --------: | ------: | ---------: | -----: |");
findings.forEach((f, i) => {
  out.push(
    `| ${i + 1} | ${f.score} | ${f.file} | ${f.lines} | ${f.inlineJsxConsts.length} | ${f.reshapeOps.length} | ${f.nestedTernaries.length} | ${f.bigJsxReturns.length} |`
  );
});
out.push("");
out.push("## Details (top 25)");
out.push("");
findings.slice(0, 25).forEach((f, i) => {
  out.push(`### ${i + 1}. ${f.file} (score ${f.score}, ${f.lines} lines)`);
  if (f.inlineJsxConsts.length) {
    out.push(`- Inline JSX consts: ${f.inlineJsxConsts.map((c) => `${c.name}@${c.line}`).join(", ")}`);
  }
  if (f.reshapeOps.length) {
    out.push(`- Reshape ops: ${f.reshapeOps.map((c) => `${c.kind}@${c.line}`).join(", ")}`);
  }
  if (f.nestedTernaries.length) {
    out.push(`- Nested ternaries: ${f.nestedTernaries.map((c) => `depth${c.depth}@${c.line}`).join(", ")}`);
  }
  if (f.bigJsxReturns.length) {
    out.push(`- Big JSX returns: ${f.bigJsxReturns.map((c) => `${c.size}L@${c.line}`).join(", ")}`);
  }
  out.push("");
});

fs.writeFileSync(path.join(ROOT, "bloat-report.md"), out.join("\n"), "utf8");
console.log(`Wrote bloat-report.md with ${findings.length} flagged files.`);
console.log("Top 15:");
findings.slice(0, 15).forEach((f, i) => {
  console.log(`${i + 1}. [${f.score}] ${f.file} (${f.lines}L)`);
});
