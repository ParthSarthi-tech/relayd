import { beforeEach, describe, expect, it, vi } from 'vitest'
import { processDelivery } from '../src/dispatcher.js'

const messageId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const endpointId = 'ffffffff-gggg-hhhh-iiii-jjjjjjjjjjjj'

const mockEnv = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
  DATABASE_URL: 'postgres://u:p@localhost/db',
  REDIS_URL: 'redis://localhost/1',
  WEBHOOK_TIMEOUT_MS: 10000,
  WEBHOOK_MAX_ATTEMPTS: 3,
  WEBHOOK_RETRY_SCHEDULE: [60, 300, 1800],
  WEBHOOK_USER_AGENT: 'Relay/1.0',
  SIGNING_ALGORITHM: 'sha256',
  RATE_LIMIT_PER_SECOND: 100,
  RATE_LIMIT_BURST: 200,
  API_PORT: 3000,
  API_HOST: '0.0.0.0',
  API_BASE_URL: 'http://localhost:3000',
  WORKER_CONCURRENCY: 5,
}

vi.mock('@relay/config', () => ({
  loadEnv: vi.fn(() => ({ ...mockEnv })),
}))

vi.mock('../src/ssrf.js', () => ({
  validateUrl: vi.fn().mockResolvedValue(undefined),
}))

let retryQueueAdd = vi.fn().mockResolvedValue({ id: 'retry-job' })
vi.mock('../src/queue.js', () => ({
  getDeliveryQueue: vi.fn(() => ({
    add: retryQueueAdd,
    close: vi.fn().mockResolvedValue(undefined),
  })),
  getConnection: vi.fn(() => {
    const store: Record<string, string> = {}
    return {
      quit: vi.fn().mockResolvedValue(undefined),
      status: 'ready',
      get: vi.fn(async (key: string) => {
        if (key.startsWith('circuit:') && !(key in store)) return '1'
        return store[key] ?? null
      }),
      set: vi.fn(async (key: string, value: string, ..._args: string[]) => {
        store[key] = value
        return 'OK'
      }),
      incr: vi.fn(async (key: string) => {
        const next = (Number(store[key] ?? 0) + 1).toString()
        store[key] = next
        return Number(next)
      }),
      expire: vi.fn().mockResolvedValue(1),
      del: vi.fn(async (key: string) => {
        delete store[key]
        return 1
      }),
      eval: vi.fn(async (_script: string, _numKeys: number, key: string, _limit: number, _windowSeconds: number) => {
        const next = (Number(store[key] ?? 0) + 1).toString()
        store[key] = next
        if (next === '1') {
          store[`${key}:expire`] = '1'
        }
        return Number(next)
      }),
    }
  }),
  createDeliveryWorker: vi.fn(),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const mockJob = { id: 'job-1', data: { messageId }, attemptsMade: 0 }

const mockMessage = {
  id: messageId,
  tenantId: '00000000-0000-0000-0000-000000000001',
  endpointId,
  eventId: 'evt_001',
  eventType: 'user.signup',
  payload: { email: 'test@example.com' },
  status: 'pending',
  attemptCount: 0,
  lastError: null,
  nextRetryAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deliveredAt: null,
}

const mockEndpoint = {
  id: endpointId,
  tenantId: '00000000-0000-0000-0000-000000000001',
  url: 'https://hooks.example.com/callback',
  description: null,
  secret: 'whsec_test_secret',
  status: 'active',
  eventTypes: [],
  rateLimitPerSecond: null,
  rateLimitBurst: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
}

const mockSigningKey = {
  id: 'sk-1',
  endpointId,
  kid: 'v1',
  secret: 'whsec_test_secret',
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  retiredAt: null,
}

function createMockDb() {
  const selectTerminal = vi.fn().mockResolvedValue([])
  const insertTerminal = vi.fn().mockResolvedValue([])
  const updateTerminal = vi.fn().mockResolvedValue([])

  function makeChain(terminal: ReturnType<typeof vi.fn>) {
    const chain: Record<string, unknown> = {
      from: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(() => terminal()),
      values: vi.fn(() => chain),
      set: vi.fn(() => chain),
      $dynamic: vi.fn(() => chain),
      // biome-ignore lint/suspicious/noThenProperty: Drizzle-style thenable
      then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
        terminal().then(resolve, reject),
    }
    return chain
  }

  return {
    select: vi.fn(() => makeChain(selectTerminal)),
    insert: vi.fn(() => makeChain(insertTerminal)),
    update: vi.fn(() => makeChain(updateTerminal)),
    delete: vi.fn(() => makeChain(vi.fn().mockResolvedValue([]))),
    execute: vi.fn().mockResolvedValue(undefined),
    _selectResults: selectTerminal,
    _insertResults: insertTerminal,
    _updateResults: updateTerminal,
  }
}

function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    level: 'error',
    child: vi.fn().mockReturnThis(),
  }
}

function okResponse(overrides?: Partial<Response>) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({}),
    text: vi.fn().mockResolvedValue('{}'),
    ...overrides,
  } as unknown as Response
}

describe('processDelivery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    retryQueueAdd = vi.fn().mockResolvedValue({ id: 'retry-job' })
  })

  it('delivers successfully', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([
      { message: mockMessage, endpoint: mockEndpoint, signingKey: mockSigningKey },
    ])
    mockFetch.mockResolvedValueOnce(okResponse())

    await processDelivery(mockJob as any, { db: db as any, log: createMockLogger() as any })

    expect(mockFetch).toHaveBeenCalledWith(
      mockEndpoint.url,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('skips when message not found', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([])
    const log = createMockLogger()

    await processDelivery(mockJob as any, { db: db as any, log: log as any })

    expect(log.warn).toHaveBeenCalledWith({ messageId }, 'Message or endpoint not found, skipping')
  })

  it('marks failed when endpoint paused', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([
      {
        message: mockMessage,
        endpoint: { ...mockEndpoint, status: 'paused' },
        signingKey: mockSigningKey,
      },
    ])

    await processDelivery(mockJob as any, { db: db as any, log: createMockLogger() as any })

    expect(db.update).toHaveBeenCalled()
  })

  it('records attempt on HTTP 500 and retries', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([
      { message: mockMessage, endpoint: mockEndpoint, signingKey: mockSigningKey },
    ])
    mockFetch.mockResolvedValueOnce(okResponse({ ok: false, status: 500 }))

    await processDelivery(mockJob as any, { db: db as any, log: createMockLogger() as any })

    expect(db.insert).toHaveBeenCalled()
  })

  it('handles timeout (AbortError)', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([
      { message: mockMessage, endpoint: mockEndpoint, signingKey: mockSigningKey },
    ])
    const err = new Error('The operation was aborted')
    err.name = 'AbortError'
    mockFetch.mockRejectedValueOnce(err)

    await processDelivery(mockJob as any, { db: db as any, log: createMockLogger() as any })

    expect(db.insert).toHaveBeenCalled()
  })

  it('handles connection error', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([
      { message: mockMessage, endpoint: mockEndpoint, signingKey: mockSigningKey },
    ])
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    await processDelivery(mockJob as any, { db: db as any, log: createMockLogger() as any })

    expect(db.insert).toHaveBeenCalled()
  })

  it('dead-letters after max attempts', async () => {
    const db = createMockDb()
    const job = { ...mockJob, attemptsMade: 2 }
    db._selectResults.mockResolvedValueOnce([
      { message: mockMessage, endpoint: mockEndpoint, signingKey: mockSigningKey },
    ])
    mockFetch.mockResolvedValueOnce(okResponse({ ok: false, status: 500 }))

    await processDelivery(job as any, { db: db as any, log: createMockLogger() as any })

    expect(db.update).toHaveBeenCalled()
  })

  it('includes kid in X-Relay-Signature header', async () => {
    const db = createMockDb()
    db._selectResults.mockResolvedValueOnce([
      { message: mockMessage, endpoint: mockEndpoint, signingKey: mockSigningKey },
    ])
    mockFetch.mockResolvedValueOnce(okResponse())

    await processDelivery(mockJob as any, { db: db as any, log: createMockLogger() as any })

    const callHeaders = (mockFetch.mock.calls[0][1] as any).headers
    expect(callHeaders['x-relay-signature']).toContain('kid=v1')
    expect(callHeaders['x-relay-message-id']).toBe(messageId)
    expect(callHeaders['x-relay-attempt']).toBe('1')
  })
})
