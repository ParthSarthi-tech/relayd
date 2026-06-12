import { zValidator } from '@hono/zod-validator'
import { endpoints, signingKeys } from '@relay/db/schema'
import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { audit } from '../lib/audit.js'
import type { Database } from '../lib/db.js'
import { NotFoundError, UnprocessableEntityError } from '../lib/errors.js'
import { requireRole } from '../middleware/rbac.js'
import { generateSecret } from '../lib/secrets.js'
import { kidParamsSchema } from '../schemas/key.js'

export function keyRoutes(db: Database) {
  return (
    new Hono()
      /**
       * GET /v1/endpoints/:id/keys — List all signing keys for an endpoint.
       */
      .get('/', zValidator('param', kidParamsSchema.pick({ id: true })), async (c) => {
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

        const keys = await db
          .select()
          .from(signingKeys)
          .where(eq(signingKeys.endpointId, id))
          .orderBy(desc(signingKeys.createdAt))
          .limit(50)

        return c.json({ data: keys.map(formatKey) })
      })

      /**
       * POST /v1/endpoints/:id/keys — Create a new signing key (rotates the endpoint secret).
       * The new key becomes active immediately; the old key stays active
       * (in-flight deliveries will complete with it).
       */
      .post('/', zValidator('param', kidParamsSchema.pick({ id: true })), async (c) => {
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

        const [latest] = await db
          .select({ kid: signingKeys.kid })
          .from(signingKeys)
          .where(eq(signingKeys.endpointId, id))
          .orderBy(desc(signingKeys.createdAt))
          .limit(1)

        const nextNum = latest ? (Number.parseInt(latest.kid.replace('v', ''), 10) || 0) + 1 : 1
        const kid = `v${nextNum}`
        const secret = generateSecret()

        const [newKey] = await db
          .insert(signingKeys)
          .values({ endpointId: id, kid, secret })
          .returning()

        if (!newKey) throw new Error('Failed to create signing key')

        await db
          .update(endpoints)
          .set({ secret, updatedAt: new Date() })
          .where(eq(endpoints.id, id))

        await audit(c, db)('key.created', { endpointId: id, metadata: { kid } })
        return c.json({ ...formatKey(newKey), secret }, 201)
      })

      /**
       * POST /v1/endpoints/:id/keys/:kid/revoke — Revoke a signing key.
       */
      .post('/:kid/revoke', requireRole('admin'), zValidator('param', kidParamsSchema), async (c) => {
        const tenantId = c.get('tenantId') as string
        const { id, kid } = c.req.valid('param')

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

        const [key] = await db
          .select()
          .from(signingKeys)
          .where(
            and(
              eq(signingKeys.endpointId, id),
              eq(signingKeys.kid, kid),
              eq(signingKeys.status, 'active'),
            ),
          )
          .limit(1)
        if (!key) throw new NotFoundError(`Signing key "${kid}" not found or already retired`)

        const rows = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(signingKeys)
          .where(and(eq(signingKeys.endpointId, id), eq(signingKeys.status, 'active')))
        const count = rows[0]?.count ?? 0
        if (count <= 1) {
          throw new UnprocessableEntityError(
            'Cannot revoke the last active signing key. Create a new key first.',
          )
        }

        const [revoked] = await db
          .update(signingKeys)
          .set({ status: 'retired', secret: null, retiredAt: new Date() })
          .where(eq(signingKeys.id, key.id))
          .returning()

        if (!revoked) throw new Error('Failed to revoke signing key')

        await audit(c, db)('key.revoked', { endpointId: id, metadata: { kid } })

        if (key.secret === endpoint.secret) {
          const [nextActive] = await db
            .select({ secret: signingKeys.secret })
            .from(signingKeys)
            .where(
              and(
                eq(signingKeys.endpointId, id),
                eq(signingKeys.status, 'active'),
                isNotNull(signingKeys.secret),
              ),
            )
            .limit(1)

          if (nextActive?.secret) {
            await db
              .update(endpoints)
              .set({ secret: nextActive.secret, updatedAt: new Date() })
              .where(eq(endpoints.id, id))
          }
        }

        return c.json({ id: revoked.id, kid: revoked.kid, status: revoked.status, revoked: true })
      })
  )
}

function formatKey(k: typeof signingKeys.$inferSelect) {
  return {
    id: k.id,
    kid: k.kid,
    status: k.status,
    createdAt: k.createdAt.toISOString(),
    retiredAt: k.retiredAt?.toISOString() ?? null,
  }
}
