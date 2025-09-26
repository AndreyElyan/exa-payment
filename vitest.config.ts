import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: [
      'apps/**/*.spec.ts',
      'apps/**/*.test.ts',
      'apps/**/__tests__/**/*.spec.ts',
      'apps/**/__tests__/**/*.test.ts',
      'apps/**/test-e2e/**/*.e2e-spec.ts',
      'apps/**/test-e2e/**/*.e2e-test.ts',
      'libs/**/*.spec.ts',
      'libs/**/*.test.ts',
      'libs/**/__tests__/**/*.spec.ts',
      'libs/**/__tests__/**/*.test.ts',
      'tests/**/*.spec.ts',
      'tests/**/*.test.ts',
    ],
    coverage: {
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['apps/**/*.{ts,js}', 'libs/**/*.{ts,js}'],
      exclude: ['**/__mocks__/**', '**/__tests__/**', '**/*.d.ts'],
    },
    root: './',
    environment: 'node',
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
