module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.js', '**/*.test.js'],
    collectCoverageFrom: [
        'api/**/*.js',
        '!api/**/*.test.js',
        '!api/_lib/**/*.test.js'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    coverageThreshold: {
        global: {
            branches: 50,
            functions: 50,
            lines: 50,
            statements: 50
        }
    },
    verbose: true,
    testTimeout: 10000
};
