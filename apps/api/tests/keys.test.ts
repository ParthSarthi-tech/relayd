import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/server.js'
import { createMockDb, createMockLogger, createMockQueues, createTestToken } from './test-utils.js'

const endpointId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

const activeEndpoint = {
  id: endpointId,
  tenantId: '00000000-0000-0000-0000-000000000001',
  url: 'https://hooks.example.com/callback',
  description: null,
  secret: 'whsec_v1_secret',
  status: 'active' as const,
  eventTypes: [],
  rateLimitPerSecond: null,
  rateLimitBurst: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
}

const keyV1 = {
  id: 'k1',
  endpointId,
  kid: 'v1',
  secret: 'whsec_v1_secret',
  status: 'active' as const,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  retiredAt: null,
}

const keyV2 = {
  id: 'k2',
  endpointId,
  kid: 'v2',
  secret: 'whsec_v2_secret',
  status: 'active' as const,
  createdAt: new Date('2026-01-02T00:00:00Z'),
  retiredAt: null,
}

function headers(token: string, extra: Record<string, string> = {}) {
  return { ...extra, Authorization: `Bearer ${token}` }
}

describe('GET /v1/endpoints/:id/keys', () => {
  let token: string

  beforeAll(async () => {
    token = await createTestToken()
  })

  it('lists signing keys', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([activeEndpoint])
    db._selectResults.mockResolvedValueOnce([keyV2, keyV1])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request(`/v1/endpoints/${endpointId}/keys`, {
      headers: headers(token),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
  })

  it('returns 404 for unknown endpoint', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/endpoints/00000000-0000-0000-0000-000000000000/keys', {
      headers: headers(token),
    })

    expect(res.status).toBe(404)
  })
})

describe('POST /v1/endpoints/:id/keys', () => {
  let token: string

  beforeAll(async () => {
    token = await createTestToken()
  })

  it('creates a new signing key and returns it with secret', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([activeEndpoint])
    db._selectResults.mockResolvedValueOnce([keyV1])
    db._insertResults.mockResolvedValueOnce([keyV2])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request(`/v1/endpoints/${endpointId}/keys`, {
      method: 'POST',
      headers: headers(token),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.kid).toBe('v2')
    expect(body.secret).toBeDefined()
  })

  it('uses v1 for first key', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([activeEndpoint])
    db._selectResults.mockResolvedValueOnce([])
    db._insertResults.mockResolvedValueOnce([{ ...keyV1, kid: 'v1' }])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request(`/v1/endpoints/${endpointId}/keys`, {
      method: 'POST',
      headers: headers(token),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.kid).toBe('v1')
  })

  it('returns 404 for unknown endpoint', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request('/v1/endpoints/00000000-0000-0000-0000-000000000000/keys', {
      method: 'POST',
      headers: headers(token),
    })

    expect(res.status).toBe(404)
  })
})

describe('POST /v1/endpoints/:id/keys/:kid/revoke', () => {
  let token: string

  beforeAll(async () => {
    token = await createTestToken()
  })

  it('revokes a key when multiple active keys exist', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([activeEndpoint])
    db._selectResults.mockResolvedValueOnce([keyV1])
    db._selectResults.mockResolvedValueOnce([{ count: 2 }])
    db._updateResults.mockResolvedValueOnce([
      {
        ...keyV1,
        status: 'retired' as const,
        secret: null,
        retiredAt: new Date(),
      },
    ])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request(`/v1/endpoints/${endpointId}/keys/v1/revoke`, {
      method: 'POST',
      headers: headers(token),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.revoked).toBe(true)
  })

  it('rejects revoking the last active key', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([activeEndpoint])
    db._selectResults.mockResolvedValueOnce([keyV1])
    db._selectResults.mockResolvedValueOnce([{ count: 1 }])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request(`/v1/endpoints/${endpointId}/keys/v1/revoke`, {
      method: 'POST',
      headers: headers(token),
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('unprocessable_entity')
  })

  it('returns 404 for unknown endpoint', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request(
      '/v1/endpoints/00000000-0000-0000-0000-000000000000/keys/v1/revoke',
      { method: 'POST', headers: headers(token) },
    )

    expect(res.status).toBe(404)
  })

  it('rotates endpoint secret to next active key when revoking current', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([activeEndpoint])
    db._selectResults.mockResolvedValueOnce([keyV1])
    db._selectResults.mockResolvedValueOnce([{ count: 2 }])
    db._updateResults.mockResolvedValueOnce([
      {
        ...keyV1,
        status: 'retired' as const,
        secret: null,
        retiredAt: new Date(),
      },
    ])
    db._selectResults.mockResolvedValueOnce([{ secret: 'whsec_v2_secret' }])

    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })

    const res = await app.request(`/v1/endpoints/${endpointId}/keys/v1/revoke`, {
      method: 'POST',
      headers: headers(token),
    })

    expect(res.status).toBe(200)
    expect(db.update).toHaveBeenCalledTimes(2)
  })
})
