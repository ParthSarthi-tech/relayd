import { zValidator } from '@hono/zod-validator'
import { attempts, messages } from '@relay/db/schema'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../lib/db.js'
import { NotFoundError, UnprocessableEntityError } from '../lib/errors.js'
import { requireRole } from '../middleware/rbac.js'
import type { Queues } from '../lib/queue.js'
import { batchDeleteSchema, batchReplaySchema, messageQuerySchema } from '../schemas/message.js'

export function messageRoutes(db: Database, queues: Queues) {
  return (
    new Hono()
      /**
       * POST /v1/messages/batch-replay — Re-enqueue multiple failed/dead-lettered messages.
       */
      .post('/batch-replay', requireRole('admin'), zValidator('json', batchReplaySchema), async (c) => {
        const tenantId = c.get('tenantId') as string
        const { ids } = c.req.valid('json')
        const results: { id: string; status: string; replayed: boolean; error?: string }[] = []

        for (const id of ids) {
          const [row] = await db
            .select()
            .from(messages)
            .where(and(eq(messages.id, id), eq(messages.tenantId, tenantId)))
            .limit(1)

          if (!row) {
            results.push({ id, status: 'not_found', replayed: false, error: 'Message not found' })
            continue
          }

          if (row.status === 'pending' || row.status === 'processing') {
            results.push({
              id,
              status: row.status,
              replayed: false,
              error: `Cannot replay message in "${row.status}" status`,
            })
            continue
          }

          await db
            .update(messages)
            .set({
              status: 'pending',
              attemptCount: 0,
              nextRetryAt: null,
              lastError: null,
              updatedAt: new Date(),
            })
            .where(eq(messages.id, id))

          await queues.delivery.add(
            'deliver',
            { messageId: id },
            {
              attempts: 1,
              removeOnComplete: 1000,
              removeOnFail: 5000,
            },
          )

          results.push({ id, status: 'pending', replayed: true })
        }

        return c.json({
          data: results,
          summary: { total: ids.length, replayed: results.filter((r) => r.replayed).length },
        })
      })

      /**
       * POST /v1/messages/batch-delete — Permanently delete multiple messages.
       */
      .post('/batch-delete', requireRole('admin'), zValidator('json', batchDeleteSchema), async (c) => {
        const tenantId = c.get('tenantId') as string
        const { ids } = c.req.valid('json')
        const results: { id: string; deleted: boolean; error?: string }[] = []

        for (const id of ids) {
          const [row] = await db
            .select({ id: messages.id })
            .from(messages)
            .where(and(eq(messages.id, id), eq(messages.tenantId, tenantId)))
            .limit(1)

          if (!row) {
            results.push({ id, deleted: false, error: 'Message not found' })
            continue
          }

          await db.delete(attempts).where(eq(attempts.messageId, id))
          await db.delete(messages).where(eq(messages.id, id))
          results.push({ id, deleted: true })
        }

        return c.json({
          data: results,
          summary: { total: ids.length, deleted: results.filter((r) => r.deleted).length },
        })
      })

      /**
       * GET /v1/messages — List messages with optional filters.
       */
      .get('/', zValidator('query', messageQuerySchema), async (c) => {
        const tenantId = c.get('tenantId') as string
        const filters = c.req.valid('query')
        const conditions = [sql`${messages.tenantId} = ${tenantId}`]

        if (filters.endpointId) {
          conditions.push(sql`${messages.endpointId} = ${filters.endpointId}`)
        }
        if (filters.status) {
          conditions.push(sql`${messages.status} = ${filters.status}`)
        }
        if (filters.eventType) {
          conditions.push(sql`${messages.eventType} = ${filters.eventType}`)
        }
        if (filters.dateFrom) {
          conditions.push(sql`${messages.createdAt} >= ${filters.dateFrom}::timestamptz`)
        }
        if (filters.dateTo) {
          conditions.push(sql`${messages.createdAt} <= ${filters.dateTo}::timestamptz`)
        }
        if (filters.cursor) {
          conditions.push(
            sql`${messages.createdAt} < (SELECT created_at FROM messages WHERE id = ${filters.cursor})`,
          )
        }

        const rows = await db
          .select()
          .from(messages)
          .where(and(...conditions))
          .orderBy(desc(messages.createdAt))
          .limit(filters.limit + 1)

        const hasMore = rows.length > filters.limit
        const items = hasMore ? rows.slice(0, filters.limit) : rows
        const nextCursor = hasMore ? items[items.length - 1]?.id : null

        return c.json({
          data: items.map(formatMessage),
          pagination: { hasMore, nextCursor },
        })
      })

      /**
       * GET /v1/messages/:id — Get a single message with full attempt history.
       */
      .get('/:id', zValidator('param', messageIdParamsSchema), async (c) => {
        const tenantId = c.get('tenantId') as string
        const { id } = c.req.valid('param')

        const [row] = await db
          .select()
          .from(messages)
          .where(and(eq(messages.id, id), eq(messages.tenantId, tenantId)))
          .limit(1)

        if (!row) throw new NotFoundError('Message not found')

        const attemptRows = await db
          .select()
          .from(attempts)
          .where(eq(attempts.messageId, id))
          .orderBy(desc(attempts.attemptNumber))
          .limit(100)

        return c.json({
          ...formatMessage(row),
          attempts: attemptRows.map(formatAttempt),
        })
      })

      /**
       * DELETE /v1/messages/:id — Permanently delete a message.
       */
      .delete('/:id', zValidator('param', messageIdParamsSchema), async (c) => {
        const tenantId = c.get('tenantId') as string
        const { id } = c.req.valid('param')

        const [row] = await db
          .select({ id: messages.id })
          .from(messages)
          .where(and(eq(messages.id, id), eq(messages.tenantId, tenantId)))
          .limit(1)

        if (!row) throw new NotFoundError('Message not found')

        await db.delete(attempts).where(eq(attempts.messageId, id))
        await db.delete(messages).where(eq(messages.id, id))

        return c.json({ id, deleted: true })
      })

      /**
       * POST /v1/messages/:id/replay — Re-enqueue a failed or dead-lettered message.
       */
      .post('/:id/replay', zValidator('param', messageIdParamsSchema), async (c) => {
        const tenantId = c.get('tenantId') as string
        const { id } = c.req.valid('param')

        const [row] = await db
          .select()
          .from(messages)
          .where(and(eq(messages.id, id), eq(messages.tenantId, tenantId)))
          .limit(1)

        if (!row) throw new NotFoundError('Message not found')

        if (row.status === 'pending' || row.status === 'processing') {
          throw new UnprocessableEntityError(
            `Cannot replay message in "${row.status}" status. Only failed or dead-lettered messages can be replayed.`,
          )
        }

        // Reset message state for retry
        await db
          .update(messages)
          .set({
            status: 'pending',
            attemptCount: 0,
            nextRetryAt: null,
            lastError: null,
            updatedAt: new Date(),
          })
          .where(eq(messages.id, id))

        // Enqueue for immediate delivery
        await queues.delivery.add(
          'deliver',
          { messageId: id },
          {
            attempts: 1,
            removeOnComplete: 1000,
            removeOnFail: 5000,
          },
        )

        return c.json({ id: row.id, status: 'pending', replayed: true })
      })
  )
}

const messageIdParamsSchema = z.object({
  id: z.string().uuid(),
})

function formatMessage(m: typeof messages.$inferSelect) {
  return {
    id: m.id,
    endpointId: m.endpointId,
    eventId: m.eventId,
    eventType: m.eventType,
    status: m.status,
    attemptCount: m.attemptCount,
    lastError: m.lastError,
    nextRetryAt: m.nextRetryAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    deliveredAt: m.deliveredAt?.toISOString() ?? null,
  }
}

function formatAttempt(a: typeof attempts.$inferSelect) {
  return {
    id: a.id,
    attemptNumber: a.attemptNumber,
    status: a.status,
    httpStatus: a.httpStatus,
    responseBody: a.responseBody,
    durationMs: a.durationMs,
    errorMessage: a.errorMessage,
    attemptedAt: a.attemptedAt.toISOString(),
    requestUrl: a.requestUrl,
  }
}
