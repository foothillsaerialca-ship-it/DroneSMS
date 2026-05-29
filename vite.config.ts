import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import license from 'rollup-plugin-license';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Generate a consolidated vendor license file during the production build
    license({
      thirdParty: {
        output: {
          file: path.join(__dirname, 'dist', 'vendor-licenses.txt'),
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
