import type { Config } from 'jest';

const cfg: Config = {
  displayName: 'testing',
  preset: 'ts-jest',
  testMatch: ['**/__tests__/**/*.spec.ts'],
};

export default cfg;
