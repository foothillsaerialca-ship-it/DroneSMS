/**
 * File purpose: Configures Vite, React transforms, source aliases, development hosting, builds, and vendor-license output.
 * Fallback/error behavior: Vite reports invalid plugins, aliases, or output paths during startup/build; no runtime fallback is provided.
 * Known issues: the production bundle currently triggers Vite's 500 kB chunk-size warning; see docs/documentation.md.
 */
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import license from 'rollup-plugin-license';

const backendRoot = path.resolve('src/app/backend');
const frontendRoot = path.resolve('src/app/frontend');
const vendorLicenseFile = path.resolve('dist/vendor-licenses.txt');

export default defineConfig({
  resolve: {
    alias: [
      { find: '@backend', replacement: backendRoot },
      { find: '@frontend', replacement: frontendRoot }
    ]
  },
  plugins: [
    react(),
    // Generate a consolidated vendor license file during the production build
    license({
      thirdParty: {
        output: {
          file: vendorLicenseFile,
          template(dependencies: any[]) {
            return dependencies
              .map((dep) => `${dep.name} v${dep.version}\nLicense: ${dep.license}\n${dep.author?.name || ''}\n${dep.licenseText}`)
              .join('\n\n---\n\n');
          }
        }
      }
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
