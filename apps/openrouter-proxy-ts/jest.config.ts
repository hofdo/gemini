export default {
  displayName: 'openrouter-proxy-ts',
  preset: '../../node_modules/@nx/jest/preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/openrouter-proxy-ts',
};
