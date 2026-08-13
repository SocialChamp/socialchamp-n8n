module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	// The build tsconfig excludes __tests__ so they never land in dist/;
	// this one includes them so the tests still type-check.
	transform: {
		'^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
	},
	roots: ['<rootDir>/nodes/', '<rootDir>/credentials/'],
	testMatch: ['**/*.test.ts'],
};
