import { zValidator } from '@hono/zod-validator'
import { transformations } from '@relay/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../lib/db.js'
import { NotFoundError } from '../lib/errors.js'
import { requireRole } from '../middleware/rbac.js'
import { runTransformation } from '../lib/transformer.js'
import { idParamsSchema, paginationSchema } from '../schemas/common.js'

const createTransformationSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  code: z.string().min(1),
})

const updateTransformationSchema = createTransformationSchema.partial()

const testTransformationSchema = z.object({
  payload: z.record(z.unknown()),
  headers: z.record(z.string()).optional(),
})

export function transformationRoutes(db: Database) {
  return new Hono()
    .post('/', zValidator('json', createTransformationSchema), async (c) => {
      const tenantId = c.get('tenantId') as string
      const input = c.req.valid('json')

      const [transformation] = await db
        .insert(transformations)
        .values({
          tenantId,
          name: input.name,
          description: input.description ?? null,
          code: input.code,
        })
        .returning()

      if (!transformation) throw new Error('Failed to create transformation')

      return c.json(formatTransformation(transformation), 201)
    })

    .get('/', zValidator('query', paginationSchema), async (c) => {
      const tenantId = c.get('tenantId') as string
      const { limit } = c.req.valid('query')

      const rows = await db
        .select()
        .from(transformations)
        .where(eq(transformations.tenantId, tenantId))
        .orderBy(desc(transformations.createdAt))
        .limit(limit)

      return c.json({ data: rows.map(formatTransformation) })
    })

    .get('/:id', zValidator('param', idParamsSchema), async (c) => {
      const tenantId = c.get('tenantId') as string
      const { id } = c.req.valid('param')

      const [row] = await db
        .select()
        .from(transformations)
        .where(and(eq(transformations.id, id), eq(transformations.tenantId, tenantId)))
        .limit(1)

      if (!row) throw new NotFoundError('Transformation not found')
      return c.json(formatTransformation(row))
    })

    .patch(
      '/:id',
      zValidator('param', idParamsSchema),
      zValidator('json', updateTransformationSchema),
      async (c) => {
        const tenantId = c.get('tenantId') as string
        const { id } = c.req.valid('param')
        const input = c.req.valid('json')

        const [updated] = await db
          .update(transformations)
          .set({
            ...(input.name !== undefined && { name: input.name }),
            ...(input.description !== undefined && { description: input.description }),
            ...(input.code !== undefined && { code: input.code }),
            updatedAt: new Date(),
          })
          .where(and(eq(transformations.id, id), eq(transformations.tenantId, tenantId)))
          .returning()

        if (!updated) throw new NotFoundError('Transformation not found')
        return c.json(formatTransformation(updated))
      },
    )

    .delete('/:id', requireRole('admin'), zValidator('param', idParamsSchema), async (c) => {
      const tenantId = c.get('tenantId') as string
      const { id } = c.req.valid('param')

      const [deleted] = await db
        .delete(transformations)
        .where(and(eq(transformations.id, id), eq(transformations.tenantId, tenantId)))
        .returning({ id: transformations.id })

      if (!deleted) throw new NotFoundError('Transformation not found')
      return c.json({ id: deleted.id, deleted: true })
    })

    .post(
      '/:id/test',
      zValidator('param', idParamsSchema),
      zValidator('json', testTransformationSchema),
      async (c) => {
        const tenantId = c.get('tenantId') as string
        const { id } = c.req.valid('param')
        const testInput = c.req.valid('json')

        const [row] = await db
          .select()
          .from(transformations)
          .where(and(eq(transformations.id, id), eq(transformations.tenantId, tenantId)))
          .limit(1)

        if (!row) throw new NotFoundError('Transformation not found')

        try {
          const result = await runTransformation(row.code, {
            payload: testInput.payload,
            headers: testInput.headers ?? {},
          })
          return c.json({ success: true, output: result })
        } catch (err) {
          return c.json({
            success: false,
            error: err instanceof Error ? err.message : 'Transformation failed',
          })
        }
      },
    )
}

function formatTransformation(t: typeof transformations.$inferSelect) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    code: t.code,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}
