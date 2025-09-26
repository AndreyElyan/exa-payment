import type { Config } from 'jest';

const cfg: Config = {
  displayName: 'api',
  preset: 'ts-jest',
  testMatch: ['**/__tests__/**/*.spec.ts'],
  moduleNameMapper: {
    '^@contracts/(.*)$': '<rootDir>/../../packages/contracts/src/$1',
    '^@config/(.*)$': '<rootDir>/../../packages/config/src/$1',
    '^@testing/(.*)$': '<rootDir>/../../packages/testing/src/$1',
  },
};

export default cfg;
