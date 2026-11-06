// Em dash and en dash ban for mobile copy (Foxing voice guidelines): string literals, template
// literal text, JSX text and JSX attribute strings that contain U+2014 or U+2013. Comments are not
// checked. A local Oxlint JS plugin (ESLint rule API), loaded by the apps/mobile override in the
// root oxlint.config.ts.
const DASH = /[–—]/;
const message =
  "Em dash and en dash not allowed. Use a comma, period, colon, or a plain hyphen for ranges.";

const noDashes = {
  meta: { type: "problem", docs: { description: "Disallow em and en dashes in copy" } },
  create(context) {
    const check = (node, text) => {
      if (typeof text === "string" && DASH.test(text)) context.report({ node, message });
    };
    return {
      Literal: (node) => check(node, node.value),
      TemplateElement: (node) => check(node, node.value.cooked ?? node.value.raw),
      JSXText: (node) => check(node, node.value),
    };
  },
};

export default {
  meta: { name: "foxing" },
  rules: { "no-dashes": noDashes },
};
