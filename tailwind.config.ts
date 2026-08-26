/**
 * File purpose: Defines Tailwind content discovery and the shared DroneSMS brand color palette.
 * Fallback/error behavior: missing content matches omit generated utilities; invalid theme values fail the CSS build.
 * Known issues: none identified during the 2026-08-25 audit.
 */
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
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
