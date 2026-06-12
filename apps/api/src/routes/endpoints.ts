import { loadEnv } from '@relay/config'
import { zValidator } from '@hono/zod-validator'
import { type Endpoint, endpoints, signingKeys } from '@relay/db/schema'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import type { Redis } from 'ioredis'
import { audit } from '../lib/audit.js'
import type { Database } from '../lib/db.js'
import { NotFoundError } from '../lib/errors.js'
import { requireRole } from '../middleware/rbac.js'
import { generateSecret } from '../lib/secrets.js'
import { idParamsSchema, paginationSchema } from '../schemas/common.js'
import { createEndpointSchema, updateEndpointSchema } from '../schemas/endpoint.js'

const CIRCUIT_PREFIX = 'circuit:endpoint:'

export function endpointRoutes(db: Database, redis?: Redis) {
  return (
    new Hono()
      /**
       * POST /v1/endpoints — Create a new endpoint.
       * Returns the endpoint plus its signing secret (only shown once).
       */
      .post('/', zValidator('json', createEndpointSchema), async (c) => {
        const input = c.req.valid('json')
        const tenantId = c.get('tenantId') as string
        const secret = generateSecret()

        const [endpoint] = await db
          .insert(endpoints)
          .values({
            tenantId,
            url: input.url,
            description: input.description ?? null,
            secret,
            eventTypes: input.eventTypes,
            rateLimitPerSecond: input.rateLimitPerSecond ?? null,
            rateLimitBurst: input.rateLimitBurst ?? null,
            timeoutMs: input.timeoutMs ?? null,
            deadLetterWebhookUrl: input.deadLetterWebhookUrl ?? null,
          })
          .returning()

        if (!endpoint) {
          throw new Error('Failed to create endpoint')
        }

        // Create initial signing key (kid = 'v1')
        await db.insert(signingKeys).values({
          endpointId: endpoint.id,
          kid: 'v1',
          secret,
        })

        await audit(c, db)('endpoint.created', {
          endpointId: endpoint.id,
          metadata: { url: input.url, eventTypes: input.eventTypes },
        })

        return c.json(
          {
            ...formatEndpoint(endpoint),
            secret, // Returned ONLY on creation
          },
          201,
        )
      })

      /**
       * GET /v1/endpoints — List endpoints.
       */
      .get('/', zValidator('query', paginationSchema), async (c) => {
        const tenantId = c.get('tenantId') as string
        const { limit, cursor } = c.req.valid('query')
        const rows = await db
          .select()
          .from(endpoints)
          .where(and(eq(endpoints.tenantId, tenantId), isNull(endpoints.deletedAt)))
          .orderBy(desc(endpoints.createdAt))
          .limit(limit + 1)

        const hasMore = rows.length > limit
        const items = hasMore ? rows.slice(0, limit) : rows
        const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : null

        return c.json({
          data: items.map(formatEndpoint),
          pagination: { hasMore, nextCursor },
        })
      })

      /**
       * GET /v1/endpoints/:id — Get a single endpoint.
       */
      .get('/:id', zValidator('param', idParamsSchema), async (c) => {
        const tenantId = c.get('tenantId') as string
        const { id } = c.req.valid('param')
        const [endpoint] = await db
          .select()
          .from(endpoints)
          .where(
            and(
              eq(endpoints.id, id),
              eq(endpoints.tenantId, tenantId),
              isNull(endpoints.deletedAt),
            ),
          )
          .limit(1)

        if (!endpoint) throw new NotFoundError('Endpoint not found')
        return c.json(formatEndpoint(endpoint))
      })

      /**
       * GET /v1/endpoints/:id/breaker — Get circuit breaker state.
       */
      .get('/:id/breaker', zValidator('param', idParamsSchema), async (c) => {
        const tenantId = c.get('tenantId') as string
        const { id } = c.req.valid('param')
        const [endpoint] = await db
          .select()
          .from(endpoints)
          .where(
            and(
              eq(endpoints.id, id),
              eq(endpoints.tenantId, tenantId),
              isNull(endpoints.deletedAt),
            ),
          )
          .limit(1)

        if (!endpoint) throw new NotFoundError('Endpoint not found')

        const open = redis ? await redis.get(`${CIRCUIT_PREFIX}${id}`) : null
        const failureCount = open ? Number(open) : 0
        const threshold = loadEnv().CIRCUIT_BREAKER_THRESHOLD

        return c.json({
          endpointId: id,
          tripped: endpoint.status === 'paused',
          open: open !== null,
          failureCount,
          threshold,
          status: endpoint.status,
        })
      })

      /**
       * PATCH /v1/endpoints/:id — Update an endpoint.
       */
      .patch(
        '/:id',
        zValidator('param', idParamsSchema),
        zValidator('json', updateEndpointSchema),
        async (c) => {
          const tenantId = c.get('tenantId') as string
          const { id } = c.req.valid('param')
          const input = c.req.valid('json')

          const [updated] = await db
            .update(endpoints)
            .set({
              ...(input.url !== undefined && { url: input.url }),
              ...(input.description !== undefined && { description: input.description }),
              ...(input.eventTypes !== undefined && { eventTypes: input.eventTypes }),
              ...(input.rateLimitPerSecond !== undefined && {
                rateLimitPerSecond: input.rateLimitPerSecond,
              }),
              ...(input.rateLimitBurst !== undefined && {
                rateLimitBurst: input.rateLimitBurst,
              }),
              ...(input.timeoutMs !== undefined && {
                timeoutMs: input.timeoutMs,
              }),
              ...(input.deadLetterWebhookUrl !== undefined && {
                deadLetterWebhookUrl: input.deadLetterWebhookUrl,
              }),
              ...(input.status !== undefined && { status: input.status }),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(endpoints.id, id),
                eq(endpoints.tenantId, tenantId),
                isNull(endpoints.deletedAt),
              ),
            )
            .returning()

          if (!updated) throw new NotFoundError('Endpoint not found')

          if (input.status === 'paused') {
            await audit(c, db)('endpoint.paused', { endpointId: id })
          } else if (input.status === 'active') {
            await audit(c, db)('endpoint.resumed', { endpointId: id })
          } else if (input.status !== undefined) {
            await audit(c, db)('endpoint.updated', {
              endpointId: id,
              metadata: { status: input.status },
            })
          }

          return c.json(formatEndpoint(updated))
        },
      )

      /**
       * DELETE /v1/endpoints/:id — Soft-delete an endpoint.
       */
      .delete('/:id', requireRole('admin'), zValidator('param', idParamsSchema), async (c) => {
        const tenantId = c.get('tenantId') as string
        const { id } = c.req.valid('param')
        const [deleted] = await db
          .update(endpoints)
          .set({ deletedAt: new Date(), status: 'disabled', updatedAt: new Date() })
          .where(
            and(
              eq(endpoints.id, id),
              eq(endpoints.tenantId, tenantId),
              isNull(endpoints.deletedAt),
            ),
          )
          .returning({ id: endpoints.id })

        if (!deleted) throw new NotFoundError('Endpoint not found')
        await audit(c, db)('endpoint.deleted', { endpointId: id })
        return c.json({ id: deleted.id, deleted: true })
      })
  )
}

function formatEndpoint(e: Endpoint) {
  return {
    id: e.id,
    url: e.url,
    description: e.description,
    status: e.status,
    eventTypes: e.eventTypes,
    rateLimitPerSecond: e.rateLimitPerSecond,
    rateLimitBurst: e.rateLimitBurst,
    timeoutMs: e.timeoutMs,
    deadLetterWebhookUrl: e.deadLetterWebhookUrl ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }
}
