import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// A dedicated document root; no App, auth, PWA, storage, or production adapters.
const root = fileURLToPath(new URL('./design/astra-field/', import.meta.url));
export default defineConfig({
  root,
  publicDir: false,
  envPrefix: 'ASTRA_UNUSED_',
  plugins: [react(), {
    name: 'astra-design-boundary',
    enforce: 'pre',
    resolveId(source) {
      if (/supabase|seedData|\/src\/|\\src\\/.test(source)) {
        throw new Error('This design study only uses its own synthetic fixtures.');
      }
    },
  }],
  server: { host: '127.0.0.1', port: 5179, strictPort: true, open: false },
  build: {
    outDir: fileURLToPath(new URL('../astra-field-build/', import.meta.url)),
    emptyOutDir: true,
  },
});
