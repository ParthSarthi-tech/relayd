import { zValidator } from '@hono/zod-validator'
import { apiKeys } from '@relay/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { audit } from '../lib/audit.js'
import type { Database } from '../lib/db.js'
import { NotFoundError, UnprocessableEntityError } from '../lib/errors.js'

const KEY_PREFIX = 'rel'

const createApiKeySchema = z.object({
  name: z.string().min(1).max(64),
  scopes: z
    .array(
      z.enum([
        'events:write',
        'events:read',
        'endpoints:write',
        'endpoints:read',
        'keys:write',
        'keys:read',
        'transformations:write',
        'transformations:read',
        'connections:write',
        'connections:read',
        'messages:read',
        'messages:write',
        'stats:read',
        'admin',
      ]),
    )
    .default([]),
})

function generateApiKey(): { fullKey: string; keyPrefix: string; keyDigest: string } {
  const raw = randomBytes(32).toString('base64url')
  const fullKey = `${KEY_PREFIX}_${raw}`
  const keyPrefix = fullKey.slice(0, 12)
  const keyDigest = createHash('sha256').update(fullKey).digest('hex')
  return { fullKey, keyPrefix, keyDigest }
}

export function apiKeyRoutes(db: Database) {
  return new Hono()
    /**
     * GET /v1/api-keys — List all API keys for the current tenant.
     */
    .get('/', async (c) => {
      const tenantId = c.get('tenantId') as string
      const keys = await db
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          scopes: apiKeys.scopes,
          active: apiKeys.active,
          expiresAt: apiKeys.expiresAt,
          lastUsedAt: apiKeys.lastUsedAt,
          createdAt: apiKeys.createdAt,
          updatedAt: apiKeys.updatedAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.tenantId, tenantId))
        .orderBy(desc(apiKeys.createdAt))
        .limit(50)

      return c.json({
        data: keys.map((k) => ({
          id: k.id,
          name: k.name,
          keyPrefix: `${k.keyPrefix}...`,
          scopes: k.scopes ? k.scopes.split(',').filter(Boolean) : [],
          active: k.active,
          expiresAt: k.expiresAt?.toISOString() ?? null,
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          createdAt: k.createdAt.toISOString(),
          updatedAt: k.updatedAt.toISOString(),
        })),
      })
    })

    /**
     * POST /v1/api-keys — Create a new API key.
     * Returns the full key only once in the response.
     */
    .post('/', zValidator('json', createApiKeySchema), async (c) => {
      const tenantId = c.get('tenantId') as string
      const userId = c.get('userId') as string
      const { name, scopes } = c.req.valid('json')

      const { fullKey, keyPrefix, keyDigest } = generateApiKey()

      const [key] = await db
        .insert(apiKeys)
        .values({
          tenantId,
          userId,
          name,
          keyPrefix,
          keyDigest,
          scopes: scopes.join(','),
        })
        .returning()

      if (!key) throw new Error('Failed to create API key')

      await audit(c, db)('api_key.created', { metadata: { name, scopes } })

      return c.json(
        {
          id: key.id,
          name: key.name,
          keyPrefix: `${key.keyPrefix}...`,
          fullKey,
          scopes,
          active: key.active,
          createdAt: key.createdAt.toISOString(),
        },
        201,
      )
    })

    /**
     * POST /v1/api-keys/:id/revoke — Revoke an API key (soft delete).
     */
    .post('/:id/revoke', async (c) => {
      const tenantId = c.get('tenantId') as string
      const id = c.req.param('id')

      const [existing] = await db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)))
        .limit(1)

      if (!existing) throw new NotFoundError('API key not found')
      if (!existing.active) throw new UnprocessableEntityError('API key is already revoked')

      const [revoked] = await db
        .update(apiKeys)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(apiKeys.id, id))
        .returning()

      if (!revoked) throw new Error('Failed to revoke API key')

      await audit(c, db)('api_key.revoked', { metadata: { name: revoked.name } })

      return c.json({ id: revoked.id, revoked: true })
    })
}
