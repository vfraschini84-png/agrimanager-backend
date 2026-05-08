module.exports = {
    testEnvironment: 'node',
    collectCoverageFrom: [
        'www/routes/**/*.js',
        'www/middleware/**/*.js',
        'www/database.js',
        'www/server.js',
        '!**/*.test.js'
    ],
    testMatch: ['www/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
    coverageThreshold: {
        global: {
            branches: 50,
            functions: 50,
            lines: 50,
            statements: 50
        }
    },
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    verbose: true,
    testTimeout: 15000,
    // ✅ Imposta NODE_ENV a 'test' durante test
    testEnvironment: 'node'
};
