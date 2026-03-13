const path = require('path');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  {
    // Next.js 권장 룰(기존 .eslintrc.json의 "next/core-web-vitals" 대체)
    extends: [
      require.resolve('eslint-config-next/core-web-vitals'),
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    settings: {
      next: {
        rootDir: __dirname,
      },
    },
  },
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'build/**',
    ],
  },
];

