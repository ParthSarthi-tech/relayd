import type { ErrorHandler } from 'hono'
import { HttpError, TooManyRequestsError } from '../lib/errors.js'
import type { Logger } from '../lib/logger.js'

export function errorHandler(log: Logger): ErrorHandler {
  return (err, c) => {
    if (err instanceof HttpError) {
      log.warn(
        { status: err.status, code: err.code, path: c.req.path, details: err.details },
        err.message,
      )

      const headers: Record<string, string> = {}
      if (err instanceof TooManyRequestsError && err.details && typeof err.details === 'object') {
        const retryAfter = (err.details as { retryAfter?: number }).retryAfter
        if (retryAfter) {
          headers['Retry-After'] = String(retryAfter)
        }
      }

      return c.json(
        { error: { code: err.code, message: err.message, details: err.details } },
        err.status as 400 | 429,
        headers,
      )
    }

    // Unexpected error — log full stack
    log.error({ err, path: c.req.path, method: c.req.method }, '[api] Unhandled error')
    return c.json({ error: { code: 'internal_error', message: 'Internal server error' } }, 500)
  }
}
