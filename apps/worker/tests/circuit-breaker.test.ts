import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  closeCircuit,
  getCircuitKey,
  isCircuitKeyExpired,
  recordFailure,
  recordSuccess,
  reopenCircuit,
  tryAcquireProbeLock,
} from '../src/circuit-breaker.js'
import type { Database } from '@relay/db/client'

const endpointId = 'ffffffff-gggg-hhhh-iii-jjjjjjjjjjjj'

function createMockRedis() {
  const store: Record<string, string> = {}
  return {
    get: vi.fn(async (key: string) => store[key] ?? null),
    set: vi.fn(async (key: string, ...args: string[]) => {
      store[key] = args[0] ?? '1'
      return 'OK'
    }),
    del: vi.fn(async (key: string) => {
      delete store[key]
      return 1
    }),
    incr: vi.fn(async (key: string) => {
      const next = (Number(store[key] ?? 0) + 1).toString()
      store[key] = next
      return Number(next)
    }),
    expire: vi.fn().mockResolvedValue(1),
    _store: store,
  }
}

function createMockDb(): Database {
  const terminal = vi.fn().mockResolvedValue([])
  const chain: Record<string, unknown> = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    set: vi.fn(() => chain),
    $dynamic: vi.fn(() => chain),
    then: (resolve: (v: unknown) => void) => terminal().then(resolve),
  }
  return {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    execute: vi.fn().mockResolvedValue([]),
  } as unknown as Database
}

describe('getCircuitKey', () => {
  it('returns the correct Redis key', () => {
    expect(getCircuitKey(endpointId)).toBe(`circuit:endpoint:${endpointId}`)
  })
})

describe('recordSuccess', () => {
  it('deletes the circuit key', async () => {
    const redis = createMockRedis()
    redis._store[`circuit:endpoint:${endpointId}`] = '3'

    await recordSuccess(redis as any, endpointId)

    expect(redis.del).toHaveBeenCalledWith(`circuit:endpoint:${endpointId}`)
    expect(redis._store[`circuit:endpoint:${endpointId}`]).toBeUndefined()
  })
})

describe('recordFailure', () => {
  it('increments failure count and sets expiry on first failure', async () => {
    const redis = createMockRedis()
    const db = createMockDb()

    const tripped = await recordFailure(redis as any, db as any, endpointId, 5, 300)

    expect(tripped).toBe(false)
    expect(redis.incr).toHaveBeenCalledWith(`circuit:endpoint:${endpointId}`)
    expect(redis.expire).toHaveBeenCalledWith(`circuit:endpoint:${endpointId}`, 300)
  })

  it('does not set expiry on subsequent failures', async () => {
    const redis = createMockRedis()
    const db = createMockDb()
    redis._store[`circuit:endpoint:${endpointId}`] = '2'

    await recordFailure(redis as any, db as any, endpointId, 5, 300)

    expect(redis.expire).not.toHaveBeenCalled()
  })

  it('trips the circuit and pauses endpoint when count reaches threshold', async () => {
    const redis = createMockRedis()
    const db = createMockDb()
    redis._store[`circuit:endpoint:${endpointId}`] = '4'

    const tripped = await recordFailure(redis as any, db as any, endpointId, 5, 300)

    expect(tripped).toBe(true)
    expect(db.update).toHaveBeenCalled()
  })

  it('does not trip when count is below threshold', async () => {
    const redis = createMockRedis()
    const db = createMockDb()
    redis._store[`circuit:endpoint:${endpointId}`] = '2'

    const tripped = await recordFailure(redis as any, db as any, endpointId, 5, 300)

    expect(tripped).toBe(false)
    expect(db.update).not.toHaveBeenCalled()
  })
})

describe('isCircuitKeyExpired', () => {
  it('returns true when circuit key is absent', async () => {
    const redis = createMockRedis()

    const expired = await isCircuitKeyExpired(redis as any, endpointId)

    expect(expired).toBe(true)
  })

  it('returns false when circuit key exists', async () => {
    const redis = createMockRedis()
    redis._store[`circuit:endpoint:${endpointId}`] = '3'

    const expired = await isCircuitKeyExpired(redis as any, endpointId)

    expect(expired).toBe(false)
  })
})

describe('tryAcquireProbeLock', () => {
  it('acquires the probe lock', async () => {
    const redis = createMockRedis()

    const acquired = await tryAcquireProbeLock(redis as any, endpointId)

    expect(acquired).toBe(true)
    expect(redis.set).toHaveBeenCalledWith(
      `probe:circuit:endpoint:${endpointId}`,
      '1',
      'EX',
      10,
    )
  })

  it('returns false when lock is already held', async () => {
    const redis = createMockRedis()
    redis.set = vi.fn().mockResolvedValue(null)

    const acquired = await tryAcquireProbeLock(redis as any, endpointId)

    expect(acquired).toBe(false)
  })
})

describe('closeCircuit', () => {
  it('clears circuit and probe keys, unpauses endpoint', async () => {
    const redis = createMockRedis()
    const db = createMockDb()
    redis._store[`circuit:endpoint:${endpointId}`] = '5'
    redis._store[`probe:circuit:endpoint:${endpointId}`] = '1'

    await closeCircuit(redis as any, db as any, endpointId)

    expect(redis.del).toHaveBeenCalledWith(`circuit:endpoint:${endpointId}`)
    expect(redis.del).toHaveBeenCalledWith(`probe:circuit:endpoint:${endpointId}`)
    expect(db.update).toHaveBeenCalled()
  })
})

describe('reopenCircuit', () => {
  it('resets counter to 1 with cooldown TTL and clears probe lock', async () => {
    const redis = createMockRedis()
    const db = createMockDb()
    redis._store[`probe:circuit:endpoint:${endpointId}`] = '1'

    await reopenCircuit(redis as any, db as any, endpointId, 300)

    expect(redis.set).toHaveBeenCalledWith(
      `circuit:endpoint:${endpointId}`,
      '1',
      'EX',
      300,
    )
    expect(redis.del).toHaveBeenCalledWith(`probe:circuit:endpoint:${endpointId}`)
  })
})
