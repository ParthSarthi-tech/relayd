import { loadEnv } from '@relay/config'
import { runCleanup } from './cleanup.js'
import { getDatabase } from './db.js'
import { processDelivery } from './dispatcher.js'
import { getLogger } from './logger.js'
import {
  setProcessing,
  startMetricsServer,
  startQueueMetricsCollection,
  stopMetricsServer,
} from './metrics.js'
import { createDeliveryWorker, getConnection, getDeliveryQueue } from './queue.js'
import { initTelemetry } from './telemetry.js'

async function main() {
  const shutdownTelemetry = await initTelemetry('relay-worker')
  const env = loadEnv()
  const log = getLogger()
  const db = getDatabase()
  const connection = getConnection()

  log.info({ env: env.NODE_ENV, concurrency: env.WORKER_CONCURRENCY }, 'Starting Relay worker')

  startMetricsServer({ db, redis: connection })
  const stopQueueMetrics = startQueueMetricsCollection(getDeliveryQueue())

  const worker = createDeliveryWorker({
    concurrency: env.WORKER_CONCURRENCY,
    processor: (job) => processDelivery(job, { db, log }),
  })

  let activeJobs = 0

  worker.on('ready', () => {
    log.info({ queue: 'webhook-delivery' }, 'Worker ready and consuming')
  })

  // Periodic data retention cleanup
  const cleanupTimer = setInterval(() => {
    runCleanup({
      db,
      log,
      retentionDays: env.DATA_RETENTION_DAYS,
    }).catch((err) => log.error({ err: String(err) }, 'Cleanup job failed'))
  }, env.CLEANUP_INTERVAL_MS)

  // Run once on startup
  runCleanup({ db, log, retentionDays: env.DATA_RETENTION_DAYS }).catch((err) =>
    log.error({ err: String(err) }, 'Initial cleanup job failed'),
  )

  worker.on('active', () => {
    activeJobs++
    setProcessing(activeJobs)
  })

  worker.on('completed', (job) => {
    log.debug({ jobId: job.id, messageId: job.data.messageId }, 'Job completed')
    activeJobs = Math.max(0, activeJobs - 1)
    setProcessing(activeJobs)
  })

  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, messageId: job?.data.messageId, err: err.message }, 'Job failed')
    activeJobs = Math.max(0, activeJobs - 1)
    setProcessing(activeJobs)
  })

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log.info({ signal }, 'Shutdown signal received')
    clearInterval(cleanupTimer)
    stopQueueMetrics()
    await worker.close()
    stopMetricsServer()
    await connection.quit()
    await shutdownTelemetry()
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('unhandledRejection', (err) => {
    log.fatal({ err }, 'Unhandled rejection')
    process.exit(1)
  })
}

main().catch((err) => {
  console.error('[worker] Fatal:', err)
  process.exit(1)
})
