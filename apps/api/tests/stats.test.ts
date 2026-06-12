import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/server.js'
import {
  authHeader,
  createMockDb,
  createMockLogger,
  createMockQueues,
  createTestToken,
} from './test-utils.js'

describe('GET /v1/stats', () => {
  let token: string

  beforeAll(async () => {
    token = await createTestToken()
  })

  it('returns aggregated stats for the default period', async () => {
    const db = createMockDb()

    // Query 1: active endpoints count
    db._selectResults.mockResolvedValueOnce([{ count: 3 }])
    // Query 2: messages by status
    db._selectResults.mockResolvedValueOnce([
      { status: 'delivered', count: 120 },
      { status: 'failed', count: 8 },
      { status: 'pending', count: 5 },
    ])
    // Query 3: total messages in period
    db._selectResults.mockResolvedValueOnce([{ count: 133 }])
    // Query 4: successful attempts count
    db._selectResults.mockResolvedValueOnce([{ count: 145 }])
    // Query 5: latency percentiles
    db._selectResults.mockResolvedValueOnce([
      {
        avgMs: 42,
        p50: 35,
        p95: 120,
        p99: 250,
      },
    ])
    // Query 6: hourly timeline
    db._selectResults.mockResolvedValueOnce([
      { hour: '2026-01-01 10:00', status: 'delivered', count: 30 },
      { hour: '2026-01-01 10:00', status: 'failed', count: 2 },
      { hour: '2026-01-01 11:00', status: 'delivered', count: 45 },
      { hour: '2026-01-01 11:00', status: 'failed', count: 1 },
    ])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })
    const res = await app.request('/v1/stats', { headers: authHeader(token) })

    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.periodHours).toBe(24)
    expect(body.activeEndpoints).toBe(3)
    expect(body.totalMessages).toBe(133)
    expect(body.deliveredCount).toBe(120)
    expect(body.failedCount).toBe(8)
    expect(body.pendingCount).toBe(5)
    expect(body.deadLetterCount).toBe(0)
    expect(body.successRate).toBe(90) // 120/133 ≈ 90%
    expect(body.successAttempts).toBe(145)
    expect(body.latencyMs.avg).toBe(42)
    expect(body.latencyMs.p50).toBe(35)
    expect(body.latencyMs.p95).toBe(120)
    expect(body.latencyMs.p99).toBe(250)
    expect(body.timeline).toHaveLength(2)
    expect(body.timeline[0].hour).toBe('2026-01-01 10:00')
    expect(body.timeline[0].delivered).toBe(30)
    expect(body.timeline[1].hour).toBe('2026-01-01 11:00')
  })

  it('returns zero values when no data exists', async () => {
    const db = createMockDb()

    // All queries return empty/zero results
    db._selectResults.mockResolvedValueOnce([{ count: 0 }])
    db._selectResults.mockResolvedValueOnce([])
    db._selectResults.mockResolvedValueOnce([{ count: 0 }])
    db._selectResults.mockResolvedValueOnce([{ count: 0 }])
    db._selectResults.mockResolvedValueOnce([{ avgMs: 0, p50: null, p95: null, p99: null }])
    db._selectResults.mockResolvedValueOnce([])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })
    const res = await app.request('/v1/stats', { headers: authHeader(token) })

    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.activeEndpoints).toBe(0)
    expect(body.totalMessages).toBe(0)
    expect(body.successRate).toBe(0)
    expect(body.latencyMs.avg).toBe(0)
    expect(body.latencyMs.p50).toBe(0)
    expect(body.timeline).toHaveLength(0)
  })

  it('accepts custom period parameter', async () => {
    const db = createMockDb()

    db._selectResults.mockResolvedValueOnce([{ count: 1 }])
    db._selectResults.mockResolvedValueOnce([])
    db._selectResults.mockResolvedValueOnce([{ count: 1 }])
    db._selectResults.mockResolvedValueOnce([{ count: 1 }])
    db._selectResults.mockResolvedValueOnce([{ avgMs: 10, p50: 10, p95: 10, p99: 10 }])
    db._selectResults.mockResolvedValueOnce([])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })
    const res = await app.request('/v1/stats?period=48', { headers: authHeader(token) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.periodHours).toBe(48)
  })

  it('rejects invalid period values', async () => {
    const db = createMockDb()
    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/stats?period=0', { headers: authHeader(token) })

    expect(res.status).toBe(400)
  })

  it('rejects period exceeding max 168 hours', async () => {
    const db = createMockDb()
    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/stats?period=200', { headers: authHeader(token) })

    expect(res.status).toBe(400)
  })

  it('returns 401 without auth header', async () => {
    const db = createMockDb()
    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/stats')

    expect(res.status).toBe(401)
  })
})
