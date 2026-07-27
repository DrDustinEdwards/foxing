// Minimal ESLint config for the em dash ban (Foxing voice guidelines).
// See foxing-vault/ai-writing-tells.md for context.

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  ignorePatterns: [
    'node_modules/',
    'libs/',
    'dist/',
    'build/',
    'android/',
    'ios/',
    '.expo/',
    '*.config.js',
  ],
  rules: {
    'no-restricted-syntax': [
      'warn',
      {
        // Catches em dash in any string literal — UI copy, comments
        // converted to template literals, log messages, error text.
        selector: "Literal[value=/—|–/]",
        message: 'Em dash and en dash not allowed. Use a comma, period, colon, or a plain hyphen for ranges. See ai-writing-tells.md.',
      },
      {
        // Also catches em dash inside template literal quasi text.
        selector: "TemplateElement[value.raw=/—|–/]",
        message: 'Em dash and en dash not allowed. Use a comma, period, colon, or a plain hyphen for ranges. See ai-writing-tells.md.',
      },
    ],
  },
}
