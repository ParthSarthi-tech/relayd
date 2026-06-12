import { describe, expect, it } from 'vitest'
import { createApp } from '../src/server.js'
import { createMockDb, createMockLogger, createMockQueues } from './test-utils.js'

describe('GET /healthz', () => {
  it('returns ok', async () => {
    const app = createApp({
      db: createMockDb(),
      queues: createMockQueues(),
      log: createMockLogger(),
    })
    const res = await app.request('/healthz')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})
