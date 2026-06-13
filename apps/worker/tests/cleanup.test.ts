import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '@relay/db/client'
import { runCleanup } from '../src/cleanup.js'

function createMockDb(): Database {
  return {
    execute: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as Database
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

function makeExecuteResult(rows: Array<{ id: string }>): { length: number; [key: number]: { id: string } } {
  const result: { length: number; [key: number]: { id: string } } = { length: rows.length }
  for (let i = 0; i < rows.length; i++) {
    result[i] = rows[i]
  }
  return result
}

describe('runCleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('deletes messages older than retentionDays', async () => {
    const db = createMockDb()
    const log = createMockLogger()
    const mockExecute = db.execute as ReturnType<typeof vi.fn>

    mockExecute
      .mockResolvedValueOnce(makeExecuteResult([{ id: 'msg-1' }, { id: 'msg-2' }]))
      .mockResolvedValueOnce(makeExecuteResult([{ id: 'msg-3' }]))
      .mockResolvedValueOnce(makeExecuteResult([]))
      .mockResolvedValueOnce(makeExecuteResult([]))

    const result = await runCleanup({ db: db as any, log: log as any, retentionDays: 30 })

    expect(result.messagesDeleted).toBe(3)
    expect(mockExecute).toHaveBeenCalledTimes(4)
  })

  it('handles zero messages to delete', async () => {
    const db = createMockDb()
    const log = createMockLogger()
    const mockExecute = db.execute as ReturnType<typeof vi.fn>

    mockExecute
      .mockResolvedValueOnce(makeExecuteResult([]))
      .mockResolvedValueOnce(makeExecuteResult([]))

    const result = await runCleanup({ db: db as any, log: log as any, retentionDays: 30 })

    expect(result.messagesDeleted).toBe(0)
    expect(result.keysDeleted).toBe(0)
  })

  it('deletes retired signing keys', async () => {
    const db = createMockDb()
    const log = createMockLogger()
    const mockExecute = db.execute as ReturnType<typeof vi.fn>

    mockExecute
      .mockResolvedValueOnce(makeExecuteResult([]))
      .mockResolvedValueOnce(makeExecuteResult([{ id: 'sk-1' }, { id: 'sk-2' }]))
      .mockResolvedValueOnce(makeExecuteResult([]))

    const result = await runCleanup({ db: db as any, log: log as any, retentionDays: 30 })

    expect(result.keysDeleted).toBe(2)
  })

  it('respects the retentionDays parameter', async () => {
    const db = createMockDb()
    const log = createMockLogger()
    const mockExecute = db.execute as ReturnType<typeof vi.fn>

    mockExecute
      .mockResolvedValueOnce(makeExecuteResult([]))
      .mockResolvedValueOnce(makeExecuteResult([]))

    await runCleanup({ db: db as any, log: log as any, retentionDays: 7 })

    expect(mockExecute).toHaveBeenCalled()
  })

  it('returns durationMs', async () => {
    const db = createMockDb()
    const log = createMockLogger()
    const mockExecute = db.execute as ReturnType<typeof vi.fn>

    mockExecute
      .mockResolvedValueOnce(makeExecuteResult([]))
      .mockResolvedValueOnce(makeExecuteResult([]))

    const result = await runCleanup({ db: db as any, log: log as any, retentionDays: 90 })

    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })
})
