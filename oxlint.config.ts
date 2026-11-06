import { defineConfig } from "oxlint";
import { base, react, node } from "@dustinedwards/devkit/oxlint";

export default defineConfig({
  extends: [base, react],
  rules: {
    // off in devkit 0.24.0
    "typescript/no-non-null-assertion": "off",
    // off in devkit 0.24.0
    "react/only-export-components": "off",
    // off in devkit 0.24.0
    "jsx-a11y/prefer-tag-over-role": "off",
    // off in devkit 0.24.0
    "jsx-a11y/control-has-associated-label": "off",
    // off in devkit 0.24.0
    "jsx-a11y/media-has-caption": "off",
  },
  // devkit's ignore patterns (Oxlint does not carry ignorePatterns through extends), then apps/mobile,
  // a separate change (CLAUDE.md hard rule 2), and apps/discord, which waits on Dustin (hard rule 9).
  ignorePatterns: [
    "build/",
    "dist/",
    ".react-router/",
    ".wrangler/",
    "worker-configuration.d.ts",
    "**/*.gen.ts",
    "apps/mobile/",
    "apps/discord/",
  ],
  overrides: [{ files: ["scripts/**", "bin/**", "test/**"], ...node }],
});
