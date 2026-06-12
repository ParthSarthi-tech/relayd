import { loadEnv } from '@relay/config'
import type { MiddlewareHandler } from 'hono'
import { SignJWT, jwtVerify } from 'jose'
import { createHash } from 'node:crypto'

export interface JwtPayload {
  sub: string
  tenantId: string
  role: string
}

function getSecret(): Uint8Array {
  return new TextEncoder().encode(loadEnv().JWT_SECRET)
}

export async function issueToken(payload: JwtPayload): Promise<string> {
  const env = loadEnv()
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(getSecret())
}

/**
 * Extract a bearer token or cookie token from the request.
 */
function extractToken(c: any): string | undefined {
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  const cookie = c.req.header('Cookie')
  if (cookie) {
    const match = cookie.split(';').find((c: string) => c.trim().startsWith('token='))
    if (match) return match.split('=')[1]
  }
}

/**
 * JWT + API key authentication middleware.
 *
 * Accepts:
 * 1. JWT tokens via `Authorization: Bearer <jwt>` or `token` cookie
 * 2. API keys via `Authorization: Bearer rel_<key>`
 *
 * If `db` is provided, API key auth is enabled.
 */
export function jwtAuthMiddleware(db?: any): MiddlewareHandler {
  return async (c, next) => {
    const token = extractToken(c)

    if (!token) {
      return c.json(
        { error: { code: 'unauthorized', message: 'Missing or invalid authorization header' } },
        401,
      )
    }

    // API key auth (rel_ prefixed tokens)
    if (token.startsWith('rel_') && db) {
      try {
        const keyDigest = createHash('sha256').update(token).digest('hex')
        const { apiKeys } = await import('@relay/db/schema')
        const { eq, and, sql } = await import('drizzle-orm')

        const [key] = await db
          .select({
            id: apiKeys.id,
            tenantId: apiKeys.tenantId,
            userId: apiKeys.userId,
            scopes: apiKeys.scopes,
            expiresAt: apiKeys.expiresAt,
          })
          .from(apiKeys)
          .where(
            and(
              eq(apiKeys.keyDigest, keyDigest),
              eq(apiKeys.active, true),
            ),
          )
          .limit(1)

        if (!key) {
          return c.json(
            { error: { code: 'unauthorized', message: 'Invalid or revoked API key' } },
            401,
          )
        }

        if (key.expiresAt && new Date() > key.expiresAt) {
          return c.json(
            { error: { code: 'unauthorized', message: 'API key has expired' } },
            401,
          )
        }

        // Update lastUsedAt (fire-and-forget)
        db
          .update(apiKeys)
          .set({ lastUsedAt: new Date() })
          .where(eq(apiKeys.id, key.id))
          .then(() => {})
          .catch(() => {})

        c.set('userId', key.userId)
        c.set('tenantId', key.tenantId)
        c.set('role', key.scopes?.includes('admin') ? 'admin' : 'member')

        await next()
        return
      } catch {
        return c.json(
          { error: { code: 'unauthorized', message: 'Invalid API key' } },
          401,
        )
      }
    }

    // JWT auth
    try {
      const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
      c.set('userId', payload.sub ?? '')
      c.set('tenantId', String(payload.tenantId ?? ''))
      c.set('role', String(payload.role ?? ''))
      await next()
    } catch {
      return c.json({ error: { code: 'unauthorized', message: 'Invalid or expired token' } }, 401)
    }
  }
}
