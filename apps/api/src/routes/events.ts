import { randomUUID } from 'node:crypto'
import { zValidator } from '@hono/zod-validator'
import { loadEnv } from '@relay/config'
import { connections, endpoints, messages, transformations } from '@relay/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import type { Database } from '../lib/db.js'
import { NotFoundError, TooManyRequestsError, UnprocessableEntityError } from '../lib/errors.js'
import { type FilterRules, evaluateFilters } from '../lib/filter.js'
import { incrementMessagesEnqueued, incrementRateLimited } from '../lib/metrics.js'
import type { Queues } from '../lib/queue.js'
import { runTransformation } from '../lib/transformer.js'
import { checkRateLimit } from '../middleware/rateLimit.js'
import { createBatchEventsSchema, createEventSchema } from '../schemas/event.js'

const IDEMPOTENCY_TTL_SEC = 86400 // 24 hours

export function eventRoutes(db: Database, queues: Queues) {
  return new Hono()
    .post('/', zValidator('json', createEventSchema), async (c) => {
      const tenantId = c.get('tenantId') as string
      const requestId = c.get('requestId') as string | undefined
      const input = c.req.valid('json')
      const result = await enqueueEvent(db, queues, tenantId, input, requestId)

      if (result.created) {
        fanOutEvent(db, queues, tenantId, input, requestId).catch(() => {})
      }

      return c.json(result, result.created ? 201 : 200)
    })

    .post('/batch', zValidator('json', createBatchEventsSchema), async (c) => {
      const tenantId = c.get('tenantId') as string
      const requestId = c.get('requestId') as string | undefined
      const { events } = c.req.valid('json')
      const results = await Promise.all(
        events.map((e) => enqueueEvent(db, queues, tenantId, e, requestId)),
      )
      const created = results.filter((r) => r.created).length

      for (const input of events) {
        fanOutEvent(db, queues, tenantId, input, requestId).catch(() => {})
      }

      return c.json(
        {
          data: results,
          summary: { total: results.length, created, deduped: results.length - created },
        },
        207,
      )
    })
}

async function fanOutEvent(
  db: Database,
  queues: Queues,
  tenantId: string,
  input: {
    endpointId: string
    eventId: string
    eventType: string
    payload: Record<string, unknown>
  },
  requestId?: string,
) {
  const conns = await db
    .select({
      connection: connections,
      transformation: transformations,
    })
    .from(connections)
    .leftJoin(
      transformations,
      and(
        eq(connections.transformationId, transformations.id),
        eq(transformations.tenantId, tenantId),
      ),
    )
    .where(and(eq(connections.tenantId, tenantId), eq(connections.enabled, true)))

  const eventCtx = {
    eventType: input.eventType,
    payload: input.payload,
    headers: {},
  }

  for (const { connection, transformation } of conns) {
    if (connection.endpointId === input.endpointId) continue
    if (!evaluateFilters(connection.filterRules as FilterRules | null | undefined, eventCtx))
      continue

    let payload = input.payload
    let extraHeaders: Record<string, string> = {}

    if (transformation) {
      try {
        const transformed = await runTransformation(transformation.code, {
          payload,
          headers: {},
        })
        payload = transformed.payload
        extraHeaders = transformed.headers
      } catch {
        continue
      }
    }

    const messageId = randomUUID()
    try {
      const [message] = await db
        .insert(messages)
        .values({
          id: messageId,
          tenantId,
          endpointId: connection.endpointId,
          eventId: input.eventId,
          eventType: input.eventType,
          payload,
          status: 'pending',
        })
        .returning()

      if (message) {
        await queues.delivery.add(
          'deliver',
          { messageId: message.id, requestId },
          { attempts: 1, removeOnComplete: 1000, removeOnFail: 5000 },
        )
        incrementMessagesEnqueued('created')
      }
    } catch {
      // Fan-out failures are non-critical — skip silently
    }
  }
}

async function enqueueEvent(
  db: Database,
  queues: Queues,
  tenantId: string,
  input: {
    endpointId: string
    eventId: string
    eventType: string
    payload: Record<string, unknown>
  },
  requestId?: string,
) {
  const [endpoint] = await db
    .select()
    .from(endpoints)
    .where(
      and(
        eq(endpoints.id, input.endpointId),
        eq(endpoints.tenantId, tenantId),
        isNull(endpoints.deletedAt),
      ),
    )
    .limit(1)

  if (!endpoint) throw new NotFoundError('Endpoint not found')
  if (endpoint.status !== 'active') {
    throw new UnprocessableEntityError(`Endpoint is ${endpoint.status}`)
  }

  if (endpoint.eventTypes.length > 0 && !endpoint.eventTypes.includes(input.eventType)) {
    throw new UnprocessableEntityError(
      `Endpoint is not subscribed to event type "${input.eventType}"`,
    )
  }

  const env = loadEnv()
  const rateLimit = endpoint.rateLimitPerSecond ?? env.RATE_LIMIT_PER_SECOND
  const burstLimit = endpoint.rateLimitBurst ?? env.RATE_LIMIT_BURST

  const { allowed: perSecondAllowed } = await checkRateLimit(
    queues.connection,
    `events:${input.endpointId}`,
    rateLimit,
  )
  const { allowed: burstAllowed } = await checkRateLimit(
    queues.connection,
    `events:${input.endpointId}:burst`,
    burstLimit,
    10,
  )

  if (!perSecondAllowed || !burstAllowed) {
    incrementRateLimited(input.endpointId)
    throw new TooManyRequestsError()
  }

  const redis = queues.connection
  const idempotencyKey = `idempotency:${input.endpointId}:${input.eventId}`
  const messageId = randomUUID()

  const claimed = await redis.set(idempotencyKey, messageId, 'EX', IDEMPOTENCY_TTL_SEC, 'NX')

  if (!claimed) {
    const [existing] = await db
      .select()
      .from(messages)
      .where(and(eq(messages.endpointId, input.endpointId), eq(messages.eventId, input.eventId)))
      .limit(1)

    if (existing) {
      incrementMessagesEnqueued('deduped')
      return {
        id: existing.id,
        endpointId: existing.endpointId,
        eventId: existing.eventId,
        eventType: existing.eventType,
        status: existing.status,
        attemptCount: existing.attemptCount,
        createdAt: existing.createdAt.toISOString(),
        created: false,
      }
    }

    await redis.del(idempotencyKey)
  }

  try {
    const [message] = await db
      .insert(messages)
      .values({
        id: messageId,
        tenantId,
        endpointId: input.endpointId,
        eventId: input.eventId,
        eventType: input.eventType,
        payload: input.payload,
        status: 'pending',
      })
      .returning()

    if (!message) throw new Error('Failed to create message')

    await queues.delivery.add(
      'deliver',
      { messageId: message.id, requestId },
      {
        attempts: 1,
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    )

    incrementMessagesEnqueued('created')
    return {
      id: message.id,
      endpointId: message.endpointId,
      eventId: message.eventId,
      eventType: message.eventType,
      status: message.status,
      attemptCount: message.attemptCount,
      createdAt: message.createdAt.toISOString(),
      created: true,
    }
  } catch (err) {
    await redis.del(idempotencyKey).catch(() => {})
    throw err
  }
}
