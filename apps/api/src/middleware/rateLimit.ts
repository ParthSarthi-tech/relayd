import type { Redis } from 'ioredis'
import { setRateLimitRemaining } from '../lib/metrics.js'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAfterMs: number
}

const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_seconds = tonumber(ARGV[2])
local current = redis.call('INCR', key)
if current == 1 then
  redis.call('EXPIRE', key, window_seconds * 3)
end
return current
`

/**
 * Check a sliding-window rate limit using an atomic Lua script.
 * Window is divided into N-second buckets keyed by `ratelimit:{key}:{window}`.
 *
 * Returns whether the request is allowed and the remaining budget.
 */
export async function checkRateLimit(
  redis: Redis,
  key: string,
  limit: number,
  windowSeconds = 1,
): Promise<RateLimitResult> {
  const windowMs = windowSeconds * 1000
  const windowKey = `ratelimit:${key}:${Math.floor(Date.now() / windowMs)}`
  const current = (await redis.eval(
    RATE_LIMIT_SCRIPT,
    1,
    windowKey,
    limit,
    windowSeconds,
  )) as number
  const remaining = Math.max(0, limit - current)
  setRateLimitRemaining(key, remaining)
  return {
    allowed: current <= limit,
    remaining,
    resetAfterMs: windowMs - (Date.now() % windowMs),
  }
}
