import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/server.js'
import { createMockDb, createMockLogger, createMockQueues, createTestToken } from './test-utils.js'

const mockEndpoint = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  tenantId: '00000000-0000-0000-0000-000000000001',
  url: 'https://hooks.example.com/callback',
  description: null,
  secret: 'whsec_test_secret_value',
  status: 'active' as const,
  eventTypes: [],
  rateLimitPerSecond: null,
  rateLimitBurst: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
}

function headers(token: string, extra: Record<string, string> = {}) {
  return { ...extra, Authorization: `Bearer ${token}` }
}

describe('POST /v1/endpoints', () => {
  let token: string

  beforeAll(async () => {
    token = await createTestToken()
  })

  it('creates an endpoint and returns 201 with secret', async () => {
    const db = createMockDb()
    db._insertResults.mockResolvedValueOnce([mockEndpoint])
    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/endpoints', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://hooks.example.com/callback' }),
      headers: headers(token, { 'Content-Type': 'application/json' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe(mockEndpoint.id)
    expect(body.secret).toBeDefined()
    expect(body.url).toBe(mockEndpoint.url)
    expect(body.status).toBe('active')
  })

  it('rejects invalid URL', async () => {
    const db = createMockDb()
    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/endpoints', {
      method: 'POST',
      body: JSON.stringify({ url: 'not-a-url' }),
      headers: headers(token, { 'Content-Type': 'application/json' }),
    })

    expect(res.status).toBe(400)
  })
})

describe('GET /v1/endpoints', () => {
  let token: string

  beforeAll(async () => {
    token = await createTestToken()
  })

  it('lists endpoints with pagination', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([mockEndpoint])
    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/endpoints', { headers: headers(token) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.pagination).toBeDefined()
    expect(body.pagination.hasMore).toBe(false)
  })

  it('returns empty list when no endpoints', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([])
    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/endpoints', { headers: headers(token) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(0)
  })
})

describe('GET /v1/endpoints/:id', () => {
  let token: string

  beforeAll(async () => {
    token = await createTestToken()
  })

  it('returns endpoint by id', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([mockEndpoint])
    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request(`/v1/endpoints/${mockEndpoint.id}`, { headers: headers(token) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(mockEndpoint.id)
  })

  it('returns 404 for unknown endpoint', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([])
    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/endpoints/00000000-0000-0000-0000-000000000000', {
      headers: headers(token),
    })

    expect(res.status).toBe(404)
  })
})

describe('PATCH /v1/endpoints/:id', () => {
  let token: string

  beforeAll(async () => {
    token = await createTestToken()
  })

  it('updates endpoint fields', async () => {
    const db = createMockDb()
    const updated = {
      ...mockEndpoint,
      url: 'https://new-url.example.com/hook',
      status: 'paused' as const,
      updatedAt: new Date(),
    }
    db._updateResults.mockResolvedValueOnce([updated])
    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request(`/v1/endpoints/${mockEndpoint.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ url: 'https://new-url.example.com/hook', status: 'paused' }),
      headers: headers(token, { 'Content-Type': 'application/json' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe('https://new-url.example.com/hook')
    expect(body.status).toBe('paused')
  })

  it('returns 404 when updating unknown endpoint', async () => {
    const db = createMockDb()
    db._updateResults.mockResolvedValueOnce([])
    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/endpoints/00000000-0000-0000-0000-000000000000', {
      method: 'PATCH',
      body: JSON.stringify({ url: 'https://new-url.example.com/hook' }),
      headers: headers(token, { 'Content-Type': 'application/json' }),
    })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /v1/endpoints/:id', () => {
  let token: string

  beforeAll(async () => {
    token = await createTestToken()
  })

  it('soft-deletes an endpoint', async () => {
    const db = createMockDb()
    db._updateResults.mockResolvedValueOnce([{ id: mockEndpoint.id }])
    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request(`/v1/endpoints/${mockEndpoint.id}`, {
      method: 'DELETE',
      headers: headers(token),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.deleted).toBe(true)
    expect(body.id).toBe(mockEndpoint.id)
  })

  it('returns 404 when deleting unknown endpoint', async () => {
    const db = createMockDb()
    db._updateResults.mockResolvedValueOnce([])
    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/endpoints/00000000-0000-0000-0000-000000000000', {
      method: 'DELETE',
      headers: headers(token),
    })

    expect(res.status).toBe(404)
  })
})
