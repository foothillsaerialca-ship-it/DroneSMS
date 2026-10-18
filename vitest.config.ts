/**
 * File purpose: Configures the Vitest component-test suite on top of the app's Vite config (aliases, React transform).
 * Fallback/error behavior: Vitest reports invalid configuration on startup; there is no runtime fallback.
 * Known issues: the node:test files (*.test.ts) are run by `npm test`, so this suite only collects *.test.tsx files.
 */
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    // Never read local .env files: tests must not receive real Supabase credentials.
    envDir: './src/test/no-env',
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.tsx'],
      setupFiles: ['./src/test/setup.ts'],
      env: {
        VITE_SUPABASE_URL: '',
        VITE_SUPABASE_ANON_KEY: '',
        VITE_APP_URL: 'http://localhost:5173'
      },
      restoreMocks: true,
      testTimeout: 10_000
    }
  })
);
