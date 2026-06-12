import { zValidator } from '@hono/zod-validator'
import { connections } from '@relay/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../lib/db.js'
import { NotFoundError } from '../lib/errors.js'
import { idParamsSchema, paginationSchema } from '../schemas/common.js'

const createConnectionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  endpointId: z.string().uuid(),
  transformationId: z.string().uuid().optional().nullable(),
  filterRules: z
    .object({
      conditions: z.array(
        z.object({
          field: z.string(),
          op: z.enum([
            'equals',
            'not_equals',
            'contains',
            'starts_with',
            'in',
            'exists',
            'gt',
            'gte',
            'lt',
            'lte',
          ]),
          value: z.unknown(),
        }),
      ),
    })
    .optional()
    .nullable(),
  enabled: z.boolean().optional(),
})

const updateConnectionSchema = createConnectionSchema.partial()

export function connectionRoutes(db: Database) {
  return new Hono()
    .post('/', zValidator('json', createConnectionSchema), async (c) => {
      const tenantId = c.get('tenantId') as string
      const input = c.req.valid('json')

      const [connection] = await db
        .insert(connections)
        .values({
          tenantId,
          name: input.name,
          description: input.description ?? null,
          endpointId: input.endpointId,
          transformationId: input.transformationId ?? null,
          filterRules: input.filterRules ?? null,
          enabled: input.enabled ?? true,
        })
        .returning()

      if (!connection) throw new Error('Failed to create connection')

      return c.json(formatConnection(connection), 201)
    })

    .get('/', zValidator('query', paginationSchema), async (c) => {
      const tenantId = c.get('tenantId') as string
      const { limit } = c.req.valid('query')

      const rows = await db
        .select()
        .from(connections)
        .where(eq(connections.tenantId, tenantId))
        .orderBy(desc(connections.createdAt))
        .limit(limit)

      return c.json({ data: rows.map(formatConnection) })
    })

    .get('/:id', zValidator('param', idParamsSchema), async (c) => {
      const tenantId = c.get('tenantId') as string
      const { id } = c.req.valid('param')

      const [row] = await db
        .select()
        .from(connections)
        .where(and(eq(connections.id, id), eq(connections.tenantId, tenantId)))
        .limit(1)

      if (!row) throw new NotFoundError('Connection not found')
      return c.json(formatConnection(row))
    })

    .patch(
      '/:id',
      zValidator('param', idParamsSchema),
      zValidator('json', updateConnectionSchema),
      async (c) => {
        const tenantId = c.get('tenantId') as string
        const { id } = c.req.valid('param')
        const input = c.req.valid('json')

        const [updated] = await db
          .update(connections)
          .set({
            ...(input.name !== undefined && { name: input.name }),
            ...(input.description !== undefined && { description: input.description }),
            ...(input.endpointId !== undefined && { endpointId: input.endpointId }),
            ...(input.transformationId !== undefined && {
              transformationId: input.transformationId,
            }),
            ...(input.filterRules !== undefined && { filterRules: input.filterRules }),
            ...(input.enabled !== undefined && { enabled: input.enabled }),
            updatedAt: new Date(),
          })
          .where(and(eq(connections.id, id), eq(connections.tenantId, tenantId)))
          .returning()

        if (!updated) throw new NotFoundError('Connection not found')
        return c.json(formatConnection(updated))
      },
    )

    .delete('/:id', zValidator('param', idParamsSchema), async (c) => {
      const tenantId = c.get('tenantId') as string
      const { id } = c.req.valid('param')

      const [deleted] = await db
        .delete(connections)
        .where(and(eq(connections.id, id), eq(connections.tenantId, tenantId)))
        .returning({ id: connections.id })

      if (!deleted) throw new NotFoundError('Connection not found')
      return c.json({ id: deleted.id, deleted: true })
    })
}

function formatConnection(c: typeof connections.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    endpointId: c.endpointId,
    transformationId: c.transformationId,
    filterRules: c.filterRules,
    enabled: c.enabled,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}
