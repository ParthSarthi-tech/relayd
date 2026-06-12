import { zValidator } from '@hono/zod-validator'
import { attempts, endpoints, messages } from '@relay/db/schema'
import { and, eq, gte, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../lib/db.js'

const statsQuerySchema = z.object({
  period: z.coerce.number().int().min(1).max(168).default(24),
})

export function statsRoutes(db: Database) {
  return new Hono().get('/', zValidator('query', statsQuerySchema), async (c) => {
    const tenantId = c.get('tenantId') as string
    const { period } = c.req.valid('query')
    const since = new Date(Date.now() - period * 3600_000)

    const [activeEndpoints] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(endpoints)
      .where(
        and(
          eq(endpoints.tenantId, tenantId),
          eq(endpoints.status, 'active'),
          isNull(endpoints.deletedAt),
        ),
      )

    const messagesByStatus = await db
      .select({
        status: messages.status,
        count: sql<number>`count(*)::int`,
      })
      .from(messages)
      .where(and(eq(messages.tenantId, tenantId), gte(messages.createdAt, since)))
      .groupBy(messages.status)

    const statusMap: Record<string, number> = {}
    for (const row of messagesByStatus) {
      statusMap[row.status] = row.count
    }

    const [totalPeriod] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.tenantId, tenantId), gte(messages.createdAt, since)))

    const totalMessages = totalPeriod?.count ?? 0

    const [successAttempts] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(attempts)
      .where(
        and(
          eq(attempts.status, 'success'),
          gte(attempts.attemptedAt, since),
          sql`${attempts.messageId} IN (SELECT id FROM messages WHERE tenant_id = ${tenantId})`,
        ),
      )

    const [latencyResult] = await db
      .select({
        avgMs: sql<number>`coalesce(avg(${attempts.durationMs}), 0)::int`,
        p50: sql<number>`percentile_cont(0.5) within group (order by ${attempts.durationMs})::int`,
        p95: sql<number>`percentile_cont(0.95) within group (order by ${attempts.durationMs})::int`,
        p99: sql<number>`percentile_cont(0.99) within group (order by ${attempts.durationMs})::int`,
      })
      .from(attempts)
      .where(
        and(
          eq(attempts.status, 'success'),
          gte(attempts.attemptedAt, since),
          sql`${attempts.messageId} IN (SELECT id FROM messages WHERE tenant_id = ${tenantId})`,
        ),
      )

    const hours = await db
      .select({
        hour: sql<string>`to_char(${messages.createdAt}, 'YYYY-MM-DD HH24:00')`,
        status: messages.status,
        count: sql<number>`count(*)::int`,
      })
      .from(messages)
      .where(and(eq(messages.tenantId, tenantId), gte(messages.createdAt, since)))
      .groupBy(sql`1, ${messages.status}`)
      .orderBy(sql`1`)

    const hourlyBuckets: Record<
      string,
      { delivered: number; failed: number; pending: number; dead: number }
    > = {}
    for (const row of hours) {
      if (!hourlyBuckets[row.hour]) {
        hourlyBuckets[row.hour] = { delivered: 0, failed: 0, pending: 0, dead: 0 }
      }
      const bucket = hourlyBuckets[row.hour]
      if (!bucket) continue
      if (row.status === 'delivered') bucket.delivered += row.count
      else if (row.status === 'failed' || row.status === 'dead_letter') {
        bucket.failed += row.count
        if (row.status === 'dead_letter') bucket.dead += row.count
      } else bucket.pending += row.count
    }

    const timeline = Object.entries(hourlyBuckets)
      .map(([hour, counts]) => ({ hour, ...counts }))
      .sort((a, b) => a.hour.localeCompare(b.hour))

    const deliveredCount = statusMap.delivered ?? 0
    const total = totalMessages || 1
    const successRate = Math.round((deliveredCount / total) * 100)

    return c.json({
      periodHours: period,
      activeEndpoints: activeEndpoints?.count ?? 0,
      totalMessages,
      deliveredCount,
      failedCount: (statusMap.failed ?? 0) + (statusMap.dead_letter ?? 0),
      pendingCount: (statusMap.pending ?? 0) + (statusMap.processing ?? 0),
      deadLetterCount: statusMap.dead_letter ?? 0,
      successRate,
      successAttempts: successAttempts?.count ?? 0,
      latencyMs: {
        avg: latencyResult?.avgMs ?? 0,
        p50: latencyResult?.p50 ?? 0,
        p95: latencyResult?.p95 ?? 0,
        p99: latencyResult?.p99 ?? 0,
      },
      timeline,
    })
  })
}
