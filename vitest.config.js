import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'dist',
        'android',
        'ios',
        '**/*.config.js',
        'src/test/**',
        'src/main.jsx',
      ],
      include: ['src/lib/**', 'src/components/**'],
      // Coverage reporting enabled. Thresholds can be added as coverage increases.
      // Current baseline: lunar.js (100%), solar.js (95%), MoonFace.jsx (100%)
    },
  },
});
