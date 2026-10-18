/**
 * File purpose: ESLint flat configuration for the TypeScript/React source, tests, and build configuration files.
 * Fallback/error behavior: ESLint reports invalid configuration or missing plugins on startup; there is no runtime fallback.
 * Known issues: pre-existing findings and the enforcement plan are recorded in docs/testing.md.
 */
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist/', 'coverage/', 'node_modules/']),
  {
    files: ['**/*.{js,ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser }
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'warn'
    },
    plugins: {
      'react-hooks': reactHooks
    },
    rules: {
      // The classic Rules of Hooks checks. The React Compiler rules bundled in newer plugin presets
      // are not enabled because the app does not use the React Compiler.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ]
    }
  },
  {
    // Build tooling, Node-based tests, and test setup run under Node.
    files: ['*.config.{js,ts}', '**/*.test.ts', 'src/test/**'],
    languageOptions: {
      globals: { ...globals.node }
    }
  },
  {
    // Supabase Edge Functions run under Deno.
    files: ['supabase/functions/**/*.ts'],
    languageOptions: {
      globals: { Deno: 'readonly' }
    }
  }
]);
