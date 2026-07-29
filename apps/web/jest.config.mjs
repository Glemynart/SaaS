import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(currentDir, '../api');

const config = {
  rootDir: currentDir,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/src/**/*.spec.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(t|j)sx?$': [
      path.join(apiDir, 'node_modules/ts-jest'),
      {
        tsconfig: {
          allowJs: true,
          esModuleInterop: true,
          jsx: 'react-jsx',
          module: 'CommonJS',
          skipLibCheck: true,
          target: 'ES2020',
        },
      },
    ],
  },
};

export default config;
