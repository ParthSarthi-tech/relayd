import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import { z } from 'zod'

/**
 * Schema for all environment variables used across Relay processes.
 * Validated at process start — fail fast on misconfiguration.
 */
const envSchema = z.object({
  // General
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  MAX_BODY_SIZE: z.coerce.number().int().positive().default(262_144), // 256 KB

  // API
  API_PORT: z.coerce.number().int().positive().default(3000),
  API_HOST: z.string().default('0.0.0.0'),
  API_BASE_URL: z.string().url().default('http://localhost:3000'),

  // Worker
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),

  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MIN: z.coerce.number().int().min(0).default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  // Redis
  REDIS_URL: z.string().url(),

  // Webhook delivery
  WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().positive().default(8),
  WEBHOOK_RETRY_SCHEDULE: z
    .string()
    .default('60,300,1800,7200,43200,86400')
    .transform((s) => s.split(',').map((n) => Number.parseInt(n.trim(), 10)))
    .pipe(z.array(z.number().int().positive())),
  WEBHOOK_USER_AGENT: z.string().default('Relay/0.1.0'),

  // Rate limiting
  RATE_LIMIT_PER_SECOND: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_BURST: z.coerce.number().int().positive().default(200),

  // CORS
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3003,http://localhost:5173')
    .transform((s) => s.split(',').map((o) => o.trim())),

  // Signing
  SIGNING_ALGORITHM: z.enum(['sha256', 'sha512']).default('sha256'),

  // Circuit breaker
  CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().int().positive().default(10),
  CIRCUIT_BREAKER_COOLDOWN_MS: z.coerce.number().int().positive().default(300_000), // 5 min

  // Data retention
  DATA_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  CLEANUP_INTERVAL_MS: z.coerce.number().int().positive().default(3_600_000), // 1 hour

  // Auth
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
})

export type Env = z.infer<typeof envSchema>

let cached: Env | undefined

export interface LoadEnvOptions {
  /** Skip loading the .env file from disk (useful in tests). */
  skipDotenv?: boolean
}

/**
 * Load and validate env vars. Call once at process start.
 * - Loads .env from workspace root (../../.env) if it exists and vars aren't already set
 * - Throws with a clear, formatted error if validation fails
 */
export function loadEnv(opts: LoadEnvOptions = {}): Env {
  if (cached) return cached

  // Try to load .env from workspace root if not already in process.env
  if (!opts.skipDotenv && !process.env.DATABASE_URL) {
    const envPath = resolve(process.cwd(), '../../.env')
    if (existsSync(envPath)) {
      loadDotenv({ path: envPath, override: false })
    }
  }

  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(
      `[config] Invalid environment variables:\n${issues}\n\nSee .env.example for reference.`,
    )
  }
  cached = result.data
  return cached
}

/**
 * Reset the cache. Useful in tests.
 */
export function resetEnvCache(): void {
  cached = undefined
}
