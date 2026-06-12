import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkRateLimit } from '../../src/middleware/rateLimit.js'

function mockRedis() {
  return {
    eval: vi.fn(),
  }
}

describe('checkRateLimit', () => {
  let redis: ReturnType<typeof mockRedis>

  beforeEach(() => {
    redis = mockRedis()
  })

  it('allows request when under limit', async () => {
    redis.eval.mockResolvedValue(1)

    const result = await checkRateLimit(redis as any, 'test-key', 10)

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(9)
  })

  it('sets expiry on first increment', async () => {
    redis.eval.mockResolvedValue(1)

    await checkRateLimit(redis as any, 'test-key', 10)

    expect(redis.eval).toHaveBeenCalledOnce()
  })

  it('does not set expiry on subsequent increments', async () => {
    redis.eval.mockResolvedValue(5)

    await checkRateLimit(redis as any, 'test-key', 10)

    expect(redis.eval).toHaveBeenCalledOnce()
  })

  it('blocks request when over limit', async () => {
    redis.eval.mockResolvedValue(11)

    const result = await checkRateLimit(redis as any, 'test-key', 10)

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('uses endpoint-specific key', async () => {
    redis.eval.mockResolvedValue(1)

    await checkRateLimit(redis as any, 'events:endpoint-123', 100)

    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      expect.stringContaining('events:endpoint-123'),
      100,
      1,
    )
  })

  it('returns resetAfterMs', async () => {
    redis.eval.mockResolvedValue(1)

    const result = await checkRateLimit(redis as any, 'test-key', 10)

    expect(result.resetAfterMs).toBeGreaterThanOrEqual(0)
    expect(result.resetAfterMs).toBeLessThanOrEqual(1000)
  })

  it('uses custom window when specified', async () => {
    redis.eval.mockResolvedValue(1)

    await checkRateLimit(redis as any, 'test-key', 10, 10)

    expect(redis.eval).toHaveBeenCalledWith(expect.any(String), 1, expect.any(String), 10, 10)
  })

  it('uses larger window for longer windowSeconds', async () => {
    redis.eval.mockResolvedValue(1)

    const result = await checkRateLimit(redis as any, 'test-key', 10, 10)

    expect(result.resetAfterMs).toBeGreaterThanOrEqual(0)
    expect(result.resetAfterMs).toBeLessThanOrEqual(10000)
  })
})
