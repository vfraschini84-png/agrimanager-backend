module.exports = {
    testEnvironment: 'node',
    collectCoverageFrom: [
        'www/routes/**/*.js',
        'www/middleware/**/*.js',
        'www/database.js',
        'www/server.js',
        '!**/*.test.js'
    ],
    testMatch: ['<rootDir>/www/__tests__/**/*.test.js'],
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    verbose: true,
    testTimeout: 15000
};
