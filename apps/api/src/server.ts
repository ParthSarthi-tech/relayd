import { loadEnv } from '@relay/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { requestId } from 'hono/request-id'
import { serveStatic } from '@hono/node-server/serve-static'
import { readFileSync } from 'fs'
import type { Database } from './lib/db.js'
import type { Logger } from './lib/logger.js'
import { metricsHandler } from './lib/metrics.js'
import type { Queues } from './lib/queue.js'
import { errorHandler } from './middleware/error.js'
import { jwtAuthMiddleware } from './middleware/jwt.js'
import { httpLogger } from './middleware/logger.js'
import { httpMetricsMiddleware } from './middleware/metrics.js'
import { bodySizeLimit } from './middleware/bodySizeLimit.js'
import { checkRateLimit } from './middleware/rateLimit.js'
import { apiKeyRoutes } from './routes/apiKeys.js'
import { authRoutes } from './routes/auth.js'
import { connectionRoutes } from './routes/connections.js'
import { echoRoutes } from './routes/echo.js'
import { endpointRoutes } from './routes/endpoints.js'
import { eventRoutes } from './routes/events.js'
import { healthRoutes } from './routes/health.js'
import { keyRoutes } from './routes/keys.js'
import { messageRoutes } from './routes/messages.js'
import { statsRoutes } from './routes/stats.js'
import { streamRoutes } from './routes/stream.js'
import { transformationRoutes } from './routes/transformations.js'

export interface AppDeps {
  db: Database
  queues: Queues
  log: Logger
}

/**
 * Build the Hono app. Exported separately so tests can mount it.
 */
export function createApp(deps: AppDeps) {
  const { log, db, queues } = deps
  const env = loadEnv()
  return new Hono()
    .use('*', requestId())
    .use('*', httpLogger(log))
    .use('*', cors({ origin: env.CORS_ORIGINS }))
    .use(
      '*',
      honoLogger((msg) => log.debug(msg)),
    )
    .use('*', httpMetricsMiddleware())
    .get('/metrics', (c) => metricsHandler())
    .route('/', healthRoutes)
    .route('/auth', authRoutes(db, queues))
    .route('/v1/echo', echoRoutes())
    .use('/v1/*', jwtAuthMiddleware(db))
    .use('/v1/*', bodySizeLimit())
    .use('/v1/*', async (c, next) => {
      const tenantId = c.get('tenantId') as string | undefined
      if (tenantId) {
        const { allowed } = await checkRateLimit(
          queues.connection,
          `tenant:${tenantId}:api`,
          1000,
          60,
        )
        if (!allowed) {
          return c.json({ error: { code: 'rate_limited', message: 'Rate limit exceeded' } }, 429)
        }
      }
      await next()
    })
    .route('/v1/api-keys', apiKeyRoutes(db))
    .route('/v1/stats', statsRoutes(db))
    .route('/v1/transformations', transformationRoutes(db))
    .route('/v1/connections', connectionRoutes(db))
    .route('/v1/endpoints', endpointRoutes(db, queues.connection))
    .route('/v1/endpoints/:id/keys', keyRoutes(db))
    .route('/v1/messages', messageRoutes(db, queues))
    .route('/v1/events', eventRoutes(db, queues))
    .route('/v1/stream', streamRoutes({ db, queues }))
    .use('/app/*', serveStatic({
      root: '/app/apps/dashboard/dist',
      rewriteRequestPath: (path) => path.replace(/^\/app/, ''),
    }))
    .use('*', serveStatic({
      root: '/app/landing-page/out',
      index: 'index.html',
    }))
    .use('/app/*', async (c) => {
      return c.html(readFileSync('/app/apps/dashboard/dist/index.html', 'utf-8'))
    })
    .use('*', async (c) => {
      return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404)
    })
    .onError(errorHandler(log))
}
