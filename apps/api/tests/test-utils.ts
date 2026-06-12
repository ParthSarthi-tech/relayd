import { vi } from 'vitest'
import type { Logger } from '../src/lib/logger.js'
import type { Queues } from '../src/lib/queue.js'
import { issueToken } from '../src/middleware/jwt.js'

export async function createTestToken(
  overrides: Partial<{ sub: string; tenantId: string; role: string }> = {},
) {
  return await issueToken({
    sub: overrides.sub ?? 'user-1',
    tenantId: overrides.tenantId ?? '00000000-0000-0000-0000-000000000001',
    role: overrides.role ?? 'admin',
  })
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` }
}

export function createMockLogger(): Logger {
  return {
    level: 'silent',
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    silent: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as Logger
}

export function createMockConnection() {
  return {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue(null),
    ping: vi.fn().mockResolvedValue('PONG'),
    quit: vi.fn().mockResolvedValue(undefined),
    status: 'ready',
  }
}

export function createMockQueue() {
  return {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    close: vi.fn().mockResolvedValue(undefined),
  }
}

export function createMockQueues() {
  const connection = createMockConnection()
  const delivery = createMockQueue()
  return { delivery, connection } as unknown as Queues
}

export type MockDb = ReturnType<typeof createMockDb>

export function createMockDb() {
  const selectTerminal = vi.fn().mockResolvedValue([])
  const insertTerminal = vi.fn().mockResolvedValue([])
  const updateTerminal = vi.fn().mockResolvedValue([])

  function makeChain(terminal: ReturnType<typeof vi.fn>) {
    const chain: Record<string, unknown> = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      groupBy: vi.fn(() => chain),
      limit: vi.fn(() => terminal()),
      values: vi.fn(() => chain),
      returning: vi.fn(() => terminal()),
      set: vi.fn(() => chain),
      $dynamic: vi.fn(() => chain),
      // biome-ignore lint/suspicious/noThenProperty: needed for Drizzle-style thenable query builder
      then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
        terminal().then(resolve, reject),
    }
    return chain as unknown as ReturnType<typeof vi.fn> & Record<string, unknown>
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
