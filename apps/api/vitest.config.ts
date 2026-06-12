import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.turbo'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/types.ts'],
    },
    env: {
      DATABASE_URL: 'postgres://localhost:5432/relay_test',
      REDIS_URL: 'redis://localhost:6379/0',
      JWT_SECRET: 'dev-jwt-secret-change-in-production',
    },
  },
})
