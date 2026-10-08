import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
  plugins: [swc.vite()],
});
