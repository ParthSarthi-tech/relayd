import { loadEnv } from '@relay/config'
import type { MiddlewareHandler } from 'hono'

export function bodySizeLimit(maxBytes?: number): MiddlewareHandler {
  const max = maxBytes ?? loadEnv().MAX_BODY_SIZE

  return async (c, next) => {
    const contentLength = c.req.header('content-length')

    if (contentLength) {
      const length = Number.parseInt(contentLength, 10)
      if (!Number.isNaN(length) && length > max) {
        return c.json(
          {
            error: {
              code: 'payload_too_large',
              message: `Request body exceeds maximum allowed size of ${max} bytes`,
            },
          },
          413,
        )
      }
    }

    await next()
  }
}
