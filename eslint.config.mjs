// @ts-check
import tseslint from 'typescript-eslint';

/**
 * THE DEPENDENCY LAW, in code.
 * core is pure. nothing imports upward. the renderer never touches electron.
 * a violation fails CI — the constitution is executable.
 */
const forbidden = {
  'packages/core/src': ['@arivo/database', '@arivo/documents', '@arivo/ui', '@arivo/reader', '@arivo/persistence', 'electron'],
  'packages/persistence/src': ['@arivo/database', '@arivo/documents', '@arivo/ui', '@arivo/reader', '@arivo/core', 'electron'],
  'packages/database/src': ['@arivo/documents', '@arivo/ui', '@arivo/reader', 'electron'],
  'packages/documents/src': ['@arivo/database', '@arivo/ui', '@arivo/reader', 'electron'],
  'packages/ui/src': ['@arivo/database', '@arivo/documents', '@arivo/reader', 'electron'],
  'packages/reader/src': ['@arivo/database', '@arivo/documents'],
  // main + preload may import electron; the renderer may not
  'apps/desktop/src/renderer': ['electron', '@arivo/database', '@arivo/documents'],
};

export default tseslint.config(
  {
    ignores: ['**/out/**', '**/dist/**', '**/node_modules/**', '**/*.mjs', '**/*.cjs', 'scripts/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // the no-any law
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  ...Object.entries(forbidden).map(([glob, paths]) => ({
    files: [`${glob}/**/*.ts`, `${glob}/**/*.tsx`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: paths.map((name) => ({ name, message: 'boundary violation: see ARCHITECTURE.md' })),
        },
      ],
    },
  })),
);
