import type { MiddlewareHandler } from 'hono'
import { recordHttpRequest } from '../lib/metrics.js'

export function httpMetricsMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const start = performance.now()
    await next()
    const duration = performance.now() - start
    recordHttpRequest(c.req.method, c.req.path, c.res.status, duration)
  }
}
