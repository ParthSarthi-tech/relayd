import type { MiddlewareHandler } from 'hono'
import type { Logger } from '../lib/logger.js'

export function httpLogger(log: Logger): MiddlewareHandler {
  return async (c, next) => {
    const start = performance.now()
    const requestId = c.get('requestId') ?? c.req.header('x-request-id') ?? '-'
    await next()
    const duration = (performance.now() - start).toFixed(1)
    log.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Number(duration),
        requestId,
      },
      'http',
    )
  }
}
