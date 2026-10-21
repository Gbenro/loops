import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  environment: 'node', include: ['src/lib/devCoordinationSecurity.test.js'],
  pool: 'forks', poolOptions: { forks: { singleFork: true } },
} });
