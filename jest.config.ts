import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/apps', '<rootDir>/libs'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.base.json', isolatedModules: true }],
  },
  moduleNameMapper: {
    '^@workspace/auth$': '<rootDir>/libs/auth/src/index.ts',
    '^@workspace/cache$': '<rootDir>/libs/cache/src/index.ts',
    '^@workspace/common$': '<rootDir>/libs/common/src/index.ts',
    '^@workspace/config$': '<rootDir>/libs/config/src/index.ts',
    '^@workspace/database$': '<rootDir>/libs/database/src/index.ts',
    '^@workspace/event-bus$': '<rootDir>/libs/event-bus/src/index.ts',
    '^@workspace/localization$': '<rootDir>/libs/localization/src/index.ts',
    '^@workspace/logger$': '<rootDir>/libs/logger/src/index.ts',
    '^@workspace/scheduler$': '<rootDir>/libs/scheduler/src/index.ts',
    '^@workspace/storage$': '<rootDir>/libs/storage/src/index.ts',
    '^@workspace/websocket$': '<rootDir>/libs/websocket/src/index.ts',
    '^@tebeka/auth$': '<rootDir>/libs/auth/src/index.ts',
    '^@tebeka/cache$': '<rootDir>/libs/cache/src/index.ts',
    '^@tebeka/common$': '<rootDir>/libs/common/src/index.ts',
    '^@tebeka/config$': '<rootDir>/libs/config/src/index.ts',
    '^@tebeka/database$': '<rootDir>/libs/database/src/index.ts',
    '^@tebeka/event-bus$': '<rootDir>/libs/event-bus/src/index.ts',
    '^@tebeka/localization$': '<rootDir>/libs/localization/src/index.ts',
    '^@tebeka/logger$': '<rootDir>/libs/logger/src/index.ts',
    '^@tebeka/scheduler$': '<rootDir>/libs/scheduler/src/index.ts',
    '^@tebeka/storage$': '<rootDir>/libs/storage/src/index.ts',
    '^@tebeka/websocket$': '<rootDir>/libs/websocket/src/index.ts',
    '^@prisma/client/financial$': '<rootDir>/node_modules/@prisma/client/financial',
    '^@prisma/client/user$': '<rootDir>/node_modules/@prisma/client/user',
    '^@prisma/client/marketplace$': '<rootDir>/node_modules/@prisma/client/marketplace',
    '^@prisma/client/communication$': '<rootDir>/node_modules/@prisma/client/communication',
  },
  collectCoverageFrom: ['apps/**/*.ts', 'libs/**/*.ts', '!**/*.spec.ts', '!**/node_modules/**'],
};

export default config;
