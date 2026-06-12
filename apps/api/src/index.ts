import { serve } from '@hono/node-server'
import { loadEnv } from '@relay/config'
import { closeDatabase, getDatabase } from './lib/db.js'
import { closeLogger, getLogger } from './lib/logger.js'
import { closeQueues, getQueues } from './lib/queue.js'
import { initTelemetry } from './lib/telemetry.js'
import { startNotificationListener, stopNotificationListener } from './lib/notifications.js'
import { createApp } from './server.js'

async function main() {
  const shutdownTelemetry = await initTelemetry('relay-api')
  const env = loadEnv()
  const log = getLogger()
  const db = getDatabase()
  const queues = getQueues()

  const app = createApp({ db, queues, log })
  log.info(
    { port: env.API_PORT, host: env.API_HOST, env: env.NODE_ENV },
    '[api] Starting Relay API',
  )

  const server = serve(
    {
      fetch: app.fetch,
      port: env.API_PORT,
      hostname: env.API_HOST,
    },
    (info) => {
      log.info({ address: info.address, port: info.port }, '[api] Listening')
    },
  )

  // Start Postgres NOTIFY listener for live SSE updates
  await startNotificationListener(db, log)

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log.info({ signal }, '[api] Shutdown signal received')
    server.close()
    await stopNotificationListener()
    await closeQueues()
    await closeDatabase()
    await closeLogger()
    await shutdownTelemetry()
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('unhandledRejection', (err) => {
    log.fatal({ err }, '[api] Unhandled rejection')
    process.exit(1)
  })
}

main().catch((err) => {
  console.error('[api] Fatal:', err)
  process.exit(1)
})
