import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The integration tests share one test database, so test files run one at a time.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
