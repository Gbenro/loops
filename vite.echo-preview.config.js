import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const adapters = fileURLToPath(new URL('./design/preview-adapters.js', import.meta.url));

// This config is only used by dev:echo-preview. The normal app has no mock aliases.
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'luna-preview-no-production-clients',
      enforce: 'pre',
      resolveId(source) {
        if (source.includes('supabase') || source.includes('seedData')) {
          throw new Error('Production clients and data seeders are excluded from the Echo preview.');
        }
      },
    },
  ],
  resolve: {
    alias: [
      { find: /^(?:.*\/)lib\/storage\.js$/, replacement: adapters },
      { find: /^(?:.*\/)lib\/audioStorage\.js$/, replacement: adapters },
      { find: /^(?:.*\/)lib\/whisper\.js$/, replacement: adapters },
      { find: /^(?:.*\/)lib\/EncryptionContext\.jsx$/, replacement: adapters },
    ],
  },
  server: { host: '127.0.0.1', port: 5178, strictPort: true, open: false },
  build: {
    outDir: 'dist-echo-preview',
    rollupOptions: { input: fileURLToPath(new URL('./design/echo-entry.html', import.meta.url)) },
  },
});
