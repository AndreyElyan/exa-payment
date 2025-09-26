import { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  projects: [
    '<rootDir>/apps/api',
    '<rootDir>/apps/consumer',
    '<rootDir>/packages/testing',
    '<rootDir>/packages/config',
  ],
  coverageDirectory: '<rootDir>/coverage',
};

export default config;
