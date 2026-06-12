import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/server.js'
import { createMockDb, createMockLogger, createMockQueues, createTestToken } from './test-utils.js'

const endpointId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const eventId = 'evt_001'
const messageId = 'ffffffff-gggg-hhhh-iiii-jjjjjjjjjjjj'

const activeEndpoint = {
  id: endpointId,
  tenantId: '00000000-0000-0000-0000-000000000001',
  url: 'https://hooks.example.com/callback',
  description: null,
  secret: 'whsec_test',
  status: 'active' as const,
  eventTypes: [],
  rateLimitPerSecond: null,
  rateLimitBurst: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
}

const pausedEndpoint = { ...activeEndpoint, status: 'paused' as const }

const filteredEndpoint = {
  ...activeEndpoint,
  eventTypes: ['order.created'],
}

const mockMessage = {
  id: messageId,
  tenantId: '00000000-0000-0000-0000-000000000001',
  endpointId,
  eventId,
  eventType: 'user.signup',
  payload: { email: 'test@example.com' },
  status: 'pending' as const,
  attemptCount: 0,
  lastError: null,
  nextRetryAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deliveredAt: null,
}

function authedHeaders(token: string, extra: Record<string, string> = {}) {
  return { ...extra, Authorization: `Bearer ${token}` }
}

describe('POST /v1/events', () => {
  let token: string

  beforeAll(async () => {
    token = await createTestToken()
  })

  it('enqueues a valid event and returns 201', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([activeEndpoint])
    db._insertResults.mockResolvedValueOnce([mockMessage])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/events', {
      method: 'POST',
      body: JSON.stringify({
        endpointId,
        eventId,
        eventType: 'user.signup',
        payload: { email: 'test@example.com' },
      }),
      headers: authedHeaders(token, { 'Content-Type': 'application/json' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe(messageId)
    expect(body.created).toBe(true)
    expect(body.status).toBe('pending')
  })

  it('returns 200 on idempotent re-send with same eventId', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([activeEndpoint])
    // Redis SET NX returns null -> idempotency key already claimed
    const queues = createMockQueues()
    queues.connection.set = queues.connection.set.mockResolvedValueOnce(null)
    // DB lookup finds existing message
    db._selectResults.mockResolvedValueOnce([mockMessage])

    const app = createApp({ db, queues, log: createMockLogger() })

    const res = await app.request('/v1/events', {
      method: 'POST',
      body: JSON.stringify({
        endpointId,
        eventId,
        eventType: 'user.signup',
        payload: { email: 'test@example.com' },
      }),
      headers: authedHeaders(token, { 'Content-Type': 'application/json' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.created).toBe(false)
  })

  it('returns 404 for unknown endpoint', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/events', {
      method: 'POST',
      body: JSON.stringify({
        endpointId: '00000000-0000-0000-0000-000000000000',
        eventId,
        eventType: 'user.signup',
        payload: {},
      }),
      headers: authedHeaders(token, { 'Content-Type': 'application/json' }),
    })

    expect(res.status).toBe(404)
  })

  it('returns 422 for paused endpoint', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([pausedEndpoint])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/events', {
      method: 'POST',
      body: JSON.stringify({
        endpointId,
        eventId,
        eventType: 'user.signup',
        payload: {},
      }),
      headers: authedHeaders(token, { 'Content-Type': 'application/json' }),
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('unprocessable_entity')
    expect(body.error.message).toContain('paused')
  })

  it('returns 422 when event type not subscribed', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([filteredEndpoint])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/events', {
      method: 'POST',
      body: JSON.stringify({
        endpointId,
        eventId,
        eventType: 'user.signup',
        payload: {},
      }),
      headers: authedHeaders(token, { 'Content-Type': 'application/json' }),
    })

    expect(res.status).toBe(422)
  })

  it('returns 429 when rate limited', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([activeEndpoint])

    const queues = createMockQueues()
    // Return high count for ALL eval calls (tenant middleware + 2 endpoint checks)
    queues.connection.eval.mockResolvedValue(999)

    const app = createApp({ db, queues, log: createMockLogger() })

    const res = await app.request('/v1/events', {
      method: 'POST',
      body: JSON.stringify({
        endpointId,
        eventId,
        eventType: 'user.signup',
        payload: {},
      }),
      headers: authedHeaders(token, { 'Content-Type': 'application/json' }),
    })

    expect(res.status).toBe(429)
  })

  it('rejects missing required fields', async () => {
    const app = createApp({
      db: createMockDb(),
      queues: createMockQueues(),
      log: createMockLogger(),
    })

    const res = await app.request('/v1/events', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: authedHeaders(token, { 'Content-Type': 'application/json' }),
    })

    expect(res.status).toBe(400)
  })
})

describe('POST /v1/events/batch', () => {
  let token: string

  beforeAll(async () => {
    token = await createTestToken()
  })

  it('processes multiple events and returns 207', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValue([activeEndpoint])
    db._insertResults.mockResolvedValue([mockMessage])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/events/batch', {
      method: 'POST',
      body: JSON.stringify({
        events: [
          {
            endpointId,
            eventId: 'evt_001',
            eventType: 'user.signup',
            payload: { email: 'a@b.com' },
          },
          {
            endpointId,
            eventId: 'evt_002',
            eventType: 'user.signup',
            payload: { email: 'c@d.com' },
          },
        ],
      }),
      headers: authedHeaders(token, { 'Content-Type': 'application/json' }),
    })

    expect(res.status).toBe(207)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    expect(body.summary.total).toBe(2)
    expect(body.summary.created).toBe(2)
  })

  it('rejects more than 1000 events', async () => {
    const app = createApp({
      db: createMockDb(),
      queues: createMockQueues(),
      log: createMockLogger(),
    })

    const res = await app.request('/v1/events/batch', {
      method: 'POST',
      body: JSON.stringify({
        events: Array.from({ length: 1001 }, (_, i) => ({
          endpointId,
          eventId: `evt_${i}`,
          eventType: 'test',
          payload: {},
        })),
      }),
      headers: authedHeaders(token, { 'Content-Type': 'application/json' }),
    })

    expect(res.status).toBe(400)
  })
})
