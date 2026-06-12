import { zValidator } from '@hono/zod-validator'
import { loadEnv } from '@relay/config'
import { tenants, users } from '@relay/db/schema'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../lib/db.js'
import { hashPassword, verifyPassword } from '../lib/hash.js'
import type { Queues } from '../lib/queue.js'
import { issueToken } from '../middleware/jwt.js'
import { checkRateLimit } from '../middleware/rateLimit.js'

function parseExpiresIn(value: string): number {
  const match = value.match(/^(\d+)([smhd])$/)
  if (!match) return 604800
  const num = Number(match[1])
  switch (match[2]) {
    case 's':
      return num
    case 'm':
      return num * 60
    case 'h':
      return num * 3600
    case 'd':
      return num * 86400
    default:
      return 604800
  }
}

const MAX_AGE_SECONDS = parseExpiresIn(loadEnv().JWT_EXPIRES_IN)

function setTokenCookie(c: import('hono').Context, token: string) {
  c.header(
    'Set-Cookie',
    `token=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`,
  )
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  tenantName: z.string().min(1).max(100).optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function authRoutes(db: Database, queues: Queues) {
  const redis = queues.connection

  async function checkAuthRateLimit(c: import('hono').Context): Promise<boolean> {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const { allowed } = await checkRateLimit(redis, `auth:${ip}`, 10, 900)
    if (!allowed) {
      return false
    }
    return true
  }

  return new Hono()
    .post('/register', zValidator('json', registerSchema), async (c) => {
      if (!(await checkAuthRateLimit(c))) {
        return c.json(
          { error: { code: 'rate_limited', message: 'Too many attempts. Try again later.' } },
          429,
        )
      }
      const input = c.req.valid('json')

      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1)
      if (existingUser.length > 0) {
        return c.json({ error: { code: 'conflict', message: 'Email already registered' } }, 409)
      }

      const tenantSlug = slugify(input.tenantName ?? input.name)
      const tenantName = input.tenantName ?? `${input.name}'s Organization`

      const [tenant] = await db
        .insert(tenants)
        .values({ name: tenantName, slug: tenantSlug })
        .returning()

      if (!tenant) {
        return c.json({ error: { code: 'internal', message: 'Failed to create tenant' } }, 500)
      }

      const passwordHash = await hashPassword(input.password)
      const [user] = await db
        .insert(users)
        .values({
          tenantId: tenant.id,
          email: input.email,
          passwordHash,
          name: input.name,
          role: 'admin',
        })
        .returning()

      if (!user) {
        return c.json({ error: { code: 'internal', message: 'Failed to create user' } }, 500)
      }

      const token = await issueToken({
        sub: user.id,
        tenantId: tenant.id,
        role: user.role,
      })

      setTokenCookie(c, token)

      return c.json(
        {
          token,
          user: { id: user.id, email: user.email, name: user.name, role: user.role },
          tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        },
        201,
      )
    })

    .post('/login', zValidator('json', loginSchema), async (c) => {
      if (!(await checkAuthRateLimit(c))) {
        return c.json(
          { error: { code: 'rate_limited', message: 'Too many attempts. Try again later.' } },
          429,
        )
      }
      const input = c.req.valid('json')

      const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1)
      if (!user) {
        return c.json(
          { error: { code: 'unauthorized', message: 'Invalid email or password' } },
          401,
        )
      }

      const valid = await verifyPassword(input.password, user.passwordHash)
      if (!valid) {
        return c.json(
          { error: { code: 'unauthorized', message: 'Invalid email or password' } },
          401,
        )
      }

      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1)
      if (!tenant) {
        return c.json({ error: { code: 'internal', message: 'Tenant not found' } }, 500)
      }

      const token = await issueToken({
        sub: user.id,
        tenantId: tenant.id,
        role: user.role,
      })

      setTokenCookie(c, token)

      return c.json({
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      })
    })

    .post('/logout', async (c) => {
      c.header('Set-Cookie', 'token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0')
      return c.json({ success: true })
    })
}
