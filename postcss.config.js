/**
 * File purpose: Registers Tailwind CSS and Autoprefixer in the PostCSS build pipeline.
 * Fallback/error behavior: missing plugins stop stylesheet compilation; there is no runtime fallback.
 * Known issues: none identified during the 2026-08-25 audit.
 */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
