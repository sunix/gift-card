module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'app.js',
    '!node_modules/**',
    '!**/*.config.js'
  ],
  setupFiles: ['<rootDir>/test-setup.js']
};
