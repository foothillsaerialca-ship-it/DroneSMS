/**
 * File purpose: Defines Tailwind content discovery and the shared DroneSMS brand color palette.
 * Fallback/error behavior: missing content matches omit generated utilities; invalid theme values fail the CSS build.
 * Known issues: none identified during the 2026-08-25 audit.
 */
import type { Config } from 'tailwindcss';

export default {
  // Component tests and their helpers are excluded so test text never adds utilities to the production CSS.
  content: ['./index.html', './src/**/*.{ts,tsx}', '!./src/**/*.test.tsx', '!./src/test/**'],
  theme: {
    extend: {
      colors: {
        brand: {
          900: '#162032',
          700: '#1B5FE8'
        }
      }
    }
  },
  plugins: []
} satisfies Config;
