import { beforeEach, describe, expect, it } from 'vitest'
import { loadEnv, resetEnvCache } from '../src/index.js'

describe('loadEnv', () => {
  beforeEach(() => {
    resetEnvCache()
    // Reset to known good defaults
    process.env.NODE_ENV = 'test'
    process.env.LOG_LEVEL = 'error'
    process.env.API_PORT = '3000'
    process.env.API_HOST = '0.0.0.0'
    process.env.API_BASE_URL = 'http://localhost:3000'
    process.env.WORKER_CONCURRENCY = '5'
    process.env.DATABASE_URL = 'postgres://u:p@localhost:5432/db'
    process.env.REDIS_URL = 'redis://localhost:6379'
    process.env.WEBHOOK_TIMEOUT_MS = '10000'
    process.env.WEBHOOK_MAX_ATTEMPTS = '8'
    process.env.WEBHOOK_RETRY_SCHEDULE = '60,300,1800'
    process.env.WEBHOOK_USER_AGENT = 'Test/1.0'
    process.env.RATE_LIMIT_PER_SECOND = '100'
    process.env.RATE_LIMIT_BURST = '200'
    process.env.SIGNING_ALGORITHM = 'sha256'
    process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters'
  })

  it('parses valid env successfully', () => {
    const env = loadEnv({ skipDotenv: true })
    expect(env.NODE_ENV).toBe('test')
    expect(env.API_PORT).toBe(3000)
    expect(env.WEBHOOK_RETRY_SCHEDULE).toEqual([60, 300, 1800])
  })

  it('coerces string numbers', () => {
    process.env.API_PORT = '4000'
    const env = loadEnv({ skipDotenv: true })
    expect(env.API_PORT).toBe(4000)
    expect(typeof env.API_PORT).toBe('number')
  })

  it('parses comma-separated retry schedule', () => {
    process.env.WEBHOOK_RETRY_SCHEDULE = '10, 20, 30, 60'
    const env = loadEnv({ skipDotenv: true })
    expect(env.WEBHOOK_RETRY_SCHEDULE).toEqual([10, 20, 30, 60])
  })

  it('throws on missing required DATABASE_URL', () => {
    delete process.env.DATABASE_URL
    expect(() => loadEnv({ skipDotenv: true })).toThrow(/DATABASE_URL/)
  })

  it('throws on invalid NODE_ENV', () => {
    process.env.NODE_ENV = 'staging'
    expect(() => loadEnv({ skipDotenv: true })).toThrow(/NODE_ENV/)
  })

  it('throws on negative API_PORT', () => {
    process.env.API_PORT = '-1'
    expect(() => loadEnv({ skipDotenv: true })).toThrow(/API_PORT/)
  })

  it('caches result on subsequent calls', () => {
    const a = loadEnv({ skipDotenv: true })
    process.env.API_PORT = '9999'
    const b = loadEnv({ skipDotenv: true })
    expect(a).toBe(b)
    expect(b.API_PORT).toBe(3000) // still cached value
  })
})
