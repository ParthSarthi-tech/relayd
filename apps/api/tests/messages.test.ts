import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/server.js'
import { createMockDb, createMockLogger, createMockQueues, createTestToken } from './test-utils.js'

const messageId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const endpointId = 'aaaaaaaa-1111-2222-3333-444444444444'

const mockMessage = {
  id: messageId,
  tenantId: '00000000-0000-0000-0000-000000000001',
  endpointId,
  eventId: 'evt_001',
  eventType: 'user.signup',
  payload: { email: 'test@example.com' },
  status: 'delivered' as const,
  attemptCount: 1,
  lastError: null,
  nextRetryAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deliveredAt: new Date('2026-01-01T00:00:01Z'),
}

const failedMessage = {
  ...mockMessage,
  status: 'failed' as const,
  attemptCount: 3,
  lastError: 'Connection refused',
  deliveredAt: null,
}

const pendingMessage = {
  ...mockMessage,
  status: 'pending' as const,
  attemptCount: 0,
  deliveredAt: null,
}

const mockAttempt = {
  id: 'attempt-1',
  messageId,
  attemptNumber: 1,
  status: 'failed' as const,
  httpStatus: 0,
  responseBody: null,
  responseHeaders: null,
  durationMs: 5000,
  errorMessage: 'Connection refused',
  attemptedAt: new Date('2026-01-01T00:00:00Z'),
  requestUrl: 'https://hooks.example.com/callback',
  requestHeaders: { 'Content-Type': 'application/json' },
}

function headers(token: string, extra: Record<string, string> = {}) {
  return { ...extra, Authorization: `Bearer ${token}` }
}

describe('GET /v1/messages', () => {
  let token: string

  beforeAll(async () => {
    token = await createTestToken()
  })

  it('lists messages with default pagination', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([mockMessage])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/messages', { headers: headers(token) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.pagination).toBeDefined()
    expect(body.data[0].id).toBe(messageId)
  })

  it('filters by endpointId', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([mockMessage])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request(`/v1/messages?endpointId=${endpointId}`, {
      headers: headers(token),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
  })

  it('filters by status', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([mockMessage])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/messages?status=delivered', {
      headers: headers(token),
    })

    expect(res.status).toBe(200)
  })

  it('returns empty list when no messages', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/messages', { headers: headers(token) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(0)
  })
})

describe('GET /v1/messages/:id', () => {
  let token: string

  beforeAll(async () => {
    token = await createTestToken()
  })

  it('returns message with attempt history', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([mockMessage])
    db._selectResults.mockResolvedValueOnce([mockAttempt])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request(`/v1/messages/${messageId}`, { headers: headers(token) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(messageId)
    expect(body.attempts).toHaveLength(1)
  })

  it('returns 404 for unknown message', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/messages/00000000-0000-0000-0000-000000000000', {
      headers: headers(token),
    })

    expect(res.status).toBe(404)
  })
})

describe('POST /v1/messages/:id/replay', () => {
  let token: string

  beforeAll(async () => {
    token = await createTestToken()
  })

  it('replays a failed message', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([failedMessage])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request(`/v1/messages/${messageId}/replay`, {
      method: 'POST',
      headers: headers(token),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.replayed).toBe(true)
    expect(body.status).toBe('pending')
  })

  it('replays a delivered message', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([mockMessage])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request(`/v1/messages/${messageId}/replay`, {
      method: 'POST',
      headers: headers(token),
    })

    expect(res.status).toBe(200)
  })

  it('rejects replay of a pending message', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([pendingMessage])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request(`/v1/messages/${messageId}/replay`, {
      method: 'POST',
      headers: headers(token),
    })

    expect(res.status).toBe(422)
  })

  it('returns 404 for unknown message', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/messages/00000000-0000-0000-0000-000000000000/replay', {
      method: 'POST',
      headers: headers(token),
    })

    expect(res.status).toBe(404)
  })
})
