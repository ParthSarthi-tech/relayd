import { describe, expect, it } from 'vitest'
import { createApp } from '../../src/server.js'
import {
  authHeader,
  createMockDb,
  createMockLogger,
  createMockQueues,
  createTestToken,
} from '../test-utils.js'

describe('authMiddleware', () => {
  it('returns 401 when no Authorization header provided', async () => {
    const app = createApp({
      db: createMockDb(),
      queues: createMockQueues(),
      log: createMockLogger(),
    })

    const res = await app.request('/v1/endpoints')

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('unauthorized')
  })

  it('returns 401 when token is wrong', async () => {
    const app = createApp({
      db: createMockDb(),
      queues: createMockQueues(),
      log: createMockLogger(),
    })

    const res = await app.request('/v1/endpoints', {
      headers: { Authorization: 'Bearer invalid-jwt-token' },
    })

    expect(res.status).toBe(401)
  })

  it('passes through with valid JWT', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([])
    const app = createApp({ db, queues: createMockQueues(), log: createMockLogger() })
    const token = await createTestToken()

    const res = await app.request('/v1/endpoints', {
      headers: authHeader(token),
    })

    expect(res.status).toBe(200)
  })

  it('does not block health endpoint', async () => {
    const app = createApp({
      db: createMockDb(),
      queues: createMockQueues(),
      log: createMockLogger(),
    })

    const res = await app.request('/healthz')

    expect(res.status).toBe(200)
  })

  it('does not block metrics endpoint', async () => {
    const app = createApp({
      db: createMockDb(),
      queues: createMockQueues(),
      log: createMockLogger(),
    })

    const res = await app.request('/metrics')

    expect(res.status).toBe(200)
  })

  it('rejects request with non-Bearer auth scheme', async () => {
    const app = createApp({
      db: createMockDb(),
      queues: createMockQueues(),
      log: createMockLogger(),
    })

    const res = await app.request('/v1/endpoints', {
      headers: { Authorization: 'Basic dGVzdDp0ZXN0' },
    })

    expect(res.status).toBe(401)
  })
})
