import type { MiddlewareHandler } from 'hono'

export function requireRole(...roles: string[]): MiddlewareHandler {
  return async (c, next) => {
    const userRole = c.get('role') as string | undefined

    if (!userRole || !roles.includes(userRole)) {
      return c.json(
        {
          error: {
            code: 'forbidden',
            message: `This action requires one of the following roles: ${roles.join(', ')}`,
          },
        },
        403,
      )
    }

    await next()
  }
}
