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
  // devkit's ignore patterns (Oxlint does not carry ignorePatterns through extends), and apps/discord,
  // which waits on Dustin (CLAUDE.md hard rule 9).
  ignorePatterns: [
    "build/",
    "dist/",
    ".react-router/",
    ".wrangler/",
    "worker-configuration.d.ts",
    "**/*.gen.ts",
    "apps/discord/",
  ],
  overrides: [
    { files: ["scripts/**", "bin/**", "test/**"], ...node },
    {
      files: ["apps/mobile/**"],
      plugins: react.plugins,
      // The Foxing voice rule for the app's copy: no em or en dash (apps/mobile/lint/no-dashes.mjs).
      jsPlugins: ["./apps/mobile/lint/no-dashes.mjs"],
      rules: {
        "foxing/no-dashes": "error",
        // React Native's TextInput autoFocus opens the keyboard in a sheet or field the reader just
        // opened; the rule is about focus jumping on a web page, which a native app does not have.
        "jsx-a11y/no-autofocus": "off",
      },
    },
  ],
});
