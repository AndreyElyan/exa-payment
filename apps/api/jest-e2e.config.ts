import type { Config } from 'jest';

const cfg: Config = {
  displayName: 'api-e2e',
  preset: 'ts-jest',
  testMatch: ['**/test-e2e/**/*.e2e-spec.ts'],
  moduleNameMapper: {
    '^@contracts/(.*)$': '<rootDir>/../../packages/contracts/src/$1',
    '^@config/(.*)$': '<rootDir>/../../packages/config/src/$1',
    '^@testing/(.*)$': '<rootDir>/../../packages/testing/src/$1',
  },
};

export default cfg;
