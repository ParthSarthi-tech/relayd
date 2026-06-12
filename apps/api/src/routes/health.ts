import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { getDatabase } from '../lib/db.js'
import { getQueues } from '../lib/queue.js'

export const healthRoutes = new Hono()
  /**
   * Liveness probe — process is up.
   */
  .get('/healthz', (c) => c.json({ status: 'ok' }))
  /**
   * Readiness probe — dependencies (DB, Redis) are reachable.
   */
  .get('/readyz', async (c) => {
    const checks: Record<string, { ok: boolean; error?: string }> = {
      database: { ok: false },
      redis: { ok: false },
    }

    try {
      const db = getDatabase()
      await db.execute(sql`SELECT 1`)
      checks.database = { ok: true }
    } catch (err) {
      checks.database = { ok: false, error: (err as Error).message }
    }

    try {
      const { connection } = getQueues()
      const pong = await connection.ping()
      checks.redis = { ok: pong === 'PONG' }
    } catch (err) {
      checks.redis = { ok: false, error: (err as Error).message }
    }

    const allOk = Object.values(checks).every((c) => c.ok)
    return c.json({ status: allOk ? 'ready' : 'not_ready', checks }, allOk ? 200 : 503)
  })
