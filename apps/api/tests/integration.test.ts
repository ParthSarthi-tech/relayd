import { describe, expect, it, beforeAll } from 'vitest'
import { createApp } from '../src/server.js'
import { createMockDb, createMockLogger, createMockQueues } from './test-utils.js'
import type { MockDb } from './test-utils.js'

describe('E2E: full platform flow', () => {
  let db: MockDb
  let queues: ReturnType<typeof createMockQueues>
  let app: ReturnType<typeof createApp>
  let token: string
  let endpointId: string
  let messageId: string

  const TENANT_ID = '00000000-0000-0000-0000-000000000001'
  const USER_ID = '00000000-0000-0000-0000-000000000002'

  function authHeaders() {
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  }

  beforeAll(async () => {
    db = createMockDb()
    queues = createMockQueues()
    app = createApp({ db, queues, log: createMockLogger() })
  })

  it('1. registers a new user and returns a JWT', async () => {
    // Mock: no existing user
    db._selectResults.mockResolvedValueOnce([])
    // Mock: insert tenant
    db._insertResults.mockResolvedValueOnce([
      { id: TENANT_ID, name: 'Test Org', slug: 'test-org' },
    ])
    // Mock: insert user
    db._insertResults.mockResolvedValueOnce([
      { id: USER_ID, tenantId: TENANT_ID, email: 'test@relay.dev', name: 'Test User', role: 'admin' },
    ])

    const res = await app.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@relay.dev',
        password: 'password123',
        name: 'Test User',
        tenantName: 'Test Org',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.token).toBeDefined()
    expect(body.user.email).toBe('test@relay.dev')
    expect(body.tenant.name).toBe('Test Org')
    token = body.token
  })

  it('2. creates an endpoint', async () => {
    endpointId = crypto.randomUUID()
    db._insertResults.mockResolvedValueOnce([
      {
        id: endpointId,
        tenantId: TENANT_ID,
        url: 'https://example.com/webhook',
        description: 'E2E endpoint',
        secret: 'whsec_test_secret',
        status: 'active',
        eventTypes: [],
        rateLimitPerSecond: null,
        rateLimitBurst: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ])

    const res = await app.request('/v1/endpoints', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/webhook', description: 'E2E endpoint' }),
      headers: authHeaders(),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe(endpointId)
    expect(body.secret).toBeDefined()
    expect(body.url).toBe('https://example.com/webhook')
    expect(body.status).toBe('active')
  })

  it('3. lists endpoints including the new one', async () => {
    const now = new Date()
    db._selectResults.mockResolvedValueOnce([
      {
        id: endpointId,
        tenantId: TENANT_ID,
        url: 'https://example.com/webhook',
        description: 'E2E endpoint',
        secret: 'whsec_test_secret',
        status: 'active',
        eventTypes: [],
        rateLimitPerSecond: null,
        rateLimitBurst: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ])

    const res = await app.request('/v1/endpoints', { headers: authHeaders() })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe(endpointId)
  })

  it('4. sends an event to the endpoint', async () => {
    messageId = crypto.randomUUID()
    // Mock: find active endpoint (for event validation)
    db._selectResults.mockResolvedValueOnce([
      {
        id: endpointId,
        tenantId: TENANT_ID,
        url: 'https://example.com/webhook',
        description: 'E2E endpoint',
        secret: 'whsec_test_secret',
        status: 'active',
        eventTypes: [],
        rateLimitPerSecond: null,
        rateLimitBurst: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ])
    // Mock: insert message (Redis SET NX returns 'OK' from default mock, then DB insert)
    db._insertResults.mockResolvedValueOnce([
      {
        id: messageId,
        tenantId: TENANT_ID,
        endpointId,
        eventId: 'evt_e2e_001',
        eventType: 'user.created',
        payload: { user_id: 42 },
        status: 'pending',
        attemptCount: 0,
        lastError: null,
        nextRetryAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deliveredAt: null,
      },
    ])

    const res = await app.request('/v1/events', {
      method: 'POST',
      body: JSON.stringify({
        endpointId,
        eventId: 'evt_e2e_001',
        eventType: 'user.created',
        payload: { user_id: 42 },
      }),
      headers: authHeaders(),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe(messageId)
    expect(body.created).toBe(true)
    expect(body.status).toBe('pending')
  })

  it('5. verifies the message appears in the messages list', async () => {
    const now = new Date()
    db._selectResults.mockResolvedValueOnce([
      {
        id: messageId,
        tenantId: TENANT_ID,
        endpointId,
        eventId: 'evt_e2e_001',
        eventType: 'user.created',
        payload: { user_id: 42 },
        status: 'pending',
        attemptCount: 0,
        lastError: null,
        nextRetryAt: null,
        createdAt: now,
        updatedAt: now,
        deliveredAt: null,
        endpointUrl: 'https://example.com/webhook',
      },
    ])

    const res = await app.request('/v1/messages', { headers: authHeaders() })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe(messageId)
    expect(body.data[0].status).toBe('pending')
  })

  it('6. verifies the delivery job was queued', async () => {
    expect(queues.delivery.add).toHaveBeenCalledWith(
      'deliver',
      expect.objectContaining({ messageId, requestId: expect.any(String) }),
      expect.objectContaining({ attempts: 1 }),
    )
  })

  it('7. retrieves aggregated stats', async () => {
    db._selectResults.mockResolvedValueOnce([{ count: 1 }])
    db._selectResults.mockResolvedValueOnce([
      { status: 'pending', count: 1 },
    ])
    db._selectResults.mockResolvedValueOnce([{ count: 1 }])
    db._selectResults.mockResolvedValueOnce([{ count: 0 }])
    db._selectResults.mockResolvedValueOnce([
      { avgMs: 0, p50: null, p95: null, p99: null },
    ])
    db._selectResults.mockResolvedValueOnce([])

    const res = await app.request('/v1/stats', { headers: authHeaders() })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.activeEndpoints).toBe(1)
    expect(body.totalMessages).toBe(1)
    expect(body.pendingCount).toBe(1)
  })

  it('8. rejects unauthenticated requests with 401', async () => {
    const res = await app.request('/v1/endpoints')
    expect(res.status).toBe(401)
  })

  it('9. rejects requests with invalid JWT', async () => {
    const res = await app.request('/v1/endpoints', {
      headers: { Authorization: 'Bearer invalid-jwt' },
    })
    expect(res.status).toBe(401)
  })
})
