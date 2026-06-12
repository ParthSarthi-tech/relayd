import type { Database } from '@relay/db/client'
import { sql } from 'drizzle-orm'
import type { Logger } from './logger.js'

const BATCH_SIZE = 1000

export interface CleanupOptions {
  db: Database
  log: Logger
  retentionDays: number
}

export interface CleanupResult {
  messagesDeleted: number
  keysDeleted: number
  durationMs: number
}

/**
 * Delete messages older than retentionDays and cascade to delivery attempts.
 * Processes in batches of 1000 to avoid long-running locks.
 * Also clean up expired signing keys.
 */
export async function runCleanup(opts: CleanupOptions): Promise<CleanupResult> {
  const { db, log, retentionDays } = opts
  const start = performance.now()
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000)

  let messagesDeleted = 0
  let keysDeleted = 0

  // Batch-delete messages (delivery attempts cascade via FK)
  while (true) {
    const result = await db.execute<{ id: string }>(sql`
      DELETE FROM messages
      WHERE id IN (
        SELECT id FROM messages
        WHERE created_at <= ${cutoff}
        LIMIT ${BATCH_SIZE}
      )
      RETURNING id
    `)
    const count = result.length ?? 0
    if (count === 0) break
    messagesDeleted += count
  }

  // Batch-delete retired signing keys
  while (true) {
    const result = await db.execute<{ id: string }>(sql`
      DELETE FROM signing_keys
      WHERE id IN (
        SELECT id FROM signing_keys
        WHERE retired_at IS NOT NULL AND retired_at <= NOW()
        LIMIT ${BATCH_SIZE}
      )
      RETURNING id
    `)
    const count = result.length ?? 0
    if (count === 0) break
    keysDeleted += count
  }

  const durationMs = Math.round(performance.now() - start)
  log.debug(
    { cutoff: cutoff.toISOString(), messagesDeleted, keysDeleted, durationMs },
    'Data retention cleanup complete',
  )

  return { messagesDeleted, keysDeleted, durationMs }
}
