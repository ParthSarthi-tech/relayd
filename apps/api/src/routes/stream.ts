import { streamSSE } from 'hono/streaming'
import { Hono } from 'hono'
import { and, desc, eq, gte } from 'drizzle-orm'
import { messages } from '@relay/db/schema'
import type { Database } from '../lib/db.js'
import type { Queues } from '../lib/queue.js'
import { subscribeToNotifications } from '../lib/notifications.js'

interface StreamDeps {
  db: Database
  queues: Queues
}

interface MessageNotification {
  id: string
  tenant_id: string
  endpoint_id: string
  event_id: string
  event_type: string
  status: string
  attempt_count: number
  last_error: string | null
  created_at: string
  updated_at: string
}

function formatMessage(m: typeof messages.$inferSelect) {
  return {
    id: m.id,
    endpointId: m.endpointId,
    eventId: m.eventId,
    eventType: m.eventType,
    status: m.status,
    attemptCount: m.attemptCount,
    lastError: m.lastError,
    createdAt: m.createdAt.toISOString(),
  }
}

async function queryStats(db: Database, tenantId: string) {
  const period = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.tenantId, tenantId), gte(messages.createdAt, period)))
    .limit(500)

  const delivered = rows.filter((r) => r.status === 'delivered').length
  const failed = rows.filter((r) => r.status === 'failed').length
  const pending = rows.filter((r) => r.status === 'pending' || r.status === 'processing').length
  const dead = rows.filter((r) => r.status === 'dead_letter').length

  return {
    periodHours: 24,
    totalMessages: rows.length,
    deliveredCount: delivered,
    failedCount: failed,
    pendingCount: pending,
    deadLetterCount: dead,
    successRate: rows.length > 0 ? Math.round((delivered / rows.length) * 100) : 100,
  }
}

export function streamRoutes(deps: StreamDeps): Hono {
  const app = new Hono()

  app.get('/live', async (c) => {
    const tenantId = c.get('tenantId') as string
    if (!tenantId) {
      return c.json({ error: { code: 'unauthorized', message: 'Not authenticated' } }, 401)
    }

    return streamSSE(c, async (stream) => {
      // Send initial stats
      const initialStats = await queryStats(deps.db, tenantId)
      await stream.writeSSE({ event: 'stats', data: JSON.stringify(initialStats) })

      // Debounced stats refresh — queue up to one recalc per 500ms
      let statsTimer: ReturnType<typeof setTimeout> | null = null
      function scheduleStatsRefresh() {
        if (statsTimer) return
        statsTimer = setTimeout(async () => {
          statsTimer = null
          try {
            const updatedStats = await queryStats(deps.db, tenantId)
            await stream.writeSSE({ event: 'stats', data: JSON.stringify(updatedStats) })
          } catch {
            // Connection likely closed
          }
        }, 500)
      }

      // Subscribe to Postgres NOTIFY events
      const unsub = subscribeToNotifications((payload: string) => {
        try {
          const data: MessageNotification = JSON.parse(payload)
          if (data.tenant_id !== tenantId) return

          stream.writeSSE({
            event: 'new-message',
            data: JSON.stringify({
              id: data.id,
              endpointId: data.endpoint_id,
              eventId: data.event_id,
              eventType: data.event_type,
              status: data.status,
              attemptCount: data.attempt_count,
              lastError: data.last_error,
              createdAt: data.created_at,
            }),
          }).catch(() => {})

          scheduleStatsRefresh()
        } catch {
          // Malformed payload — ignore
        }
      })

      // Fallback poll timer — catches any missed notifications
      const fallbackTimer = setInterval(async () => {
        try {
          const cutoff = new Date(Date.now() - 60_000)
          const newRows = await deps.db
            .select()
            .from(messages)
            .where(
              and(
                eq(messages.tenantId, tenantId),
                gte(messages.updatedAt, cutoff),
              ),
            )
            .orderBy(desc(messages.createdAt))
            .limit(10)

          if (newRows.length > 0) {
            for (const row of newRows) {
              await stream.writeSSE({
                event: 'new-message',
                data: JSON.stringify(formatMessage(row)),
              })
            }
            const updatedStats = await queryStats(deps.db, tenantId)
            await stream.writeSSE({ event: 'stats', data: JSON.stringify(updatedStats) })
          }
        } catch {
          // Connection likely closed
        }
      }, 30_000)

      // Heartbeat to keep connection alive through proxies
      const heartbeatTimer = setInterval(async () => {
        try {
          await stream.writeSSE({
            event: 'heartbeat',
            data: JSON.stringify({ ts: new Date().toISOString() }),
          })
        } catch {
          // Connection likely closed
        }
      }, 15_000)

      stream.onAbort(() => {
        unsub()
        clearInterval(fallbackTimer)
        clearInterval(heartbeatTimer)
        if (statsTimer) clearTimeout(statsTimer)
      })
    })
  })

  return app
}
