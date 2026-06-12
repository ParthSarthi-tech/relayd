import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { sql } from 'drizzle-orm'
import type { Queue } from 'bullmq'
import type { Database } from '@relay/db/client'
import type { Redis } from 'ioredis'
import promClient from 'prom-client'
import { getLogger } from './logger.js'
import { getDeadLetterQueue, getDeliveryQueue } from './queue.js'

const register = new promClient.Registry()

promClient.collectDefaultMetrics({ register })

const deliveriesTotal = new promClient.Counter({
  name: 'relay_worker_deliveries_total',
  help: 'Total number of webhook deliveries processed',
  labelNames: ['status', 'endpoint_id'],
  registers: [register],
})

const deliveryDurationMs = new promClient.Histogram({
  name: 'relay_worker_delivery_duration_ms',
  help: 'Duration of webhook delivery attempts in milliseconds',
  labelNames: ['status'],
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  registers: [register],
})

const retriesTotal = new promClient.Counter({
  name: 'relay_worker_retries_total',
  help: 'Total number of delivery retries scheduled',
  registers: [register],
})

const deadLetteredTotal = new promClient.Counter({
  name: 'relay_worker_dead_lettered_total',
  help: 'Total number of messages dead-lettered after max attempts',
  registers: [register],
})

const currentlyProcessing = new promClient.Gauge({
  name: 'relay_worker_processing_now',
  help: 'Number of deliveries currently being processed',
  registers: [register],
})

const rateLimitedDeliveries = new promClient.Counter({
  name: 'relay_worker_rate_limited_total',
  help: 'Total number of deliveries rate-limited at dispatch time',
  labelNames: ['endpoint_id'],
  registers: [register],
})

// BullMQ queue metrics

const queueJobCounts = new promClient.Gauge({
  name: 'relay_worker_queue_jobs',
  help: 'Number of jobs in the delivery queue by state',
  labelNames: ['queue', 'state'],
  registers: [register],
})

const queueWorkersCount = new promClient.Gauge({
  name: 'relay_worker_queue_workers',
  help: 'Number of active workers for the delivery queue',
  labelNames: ['queue'],
  registers: [register],
})

let metricsServer: ReturnType<typeof createServer> | null = null

export function recordDelivery(
  status: 'success' | 'failed' | 'timeout' | 'connection_error',
  endpointId: string,
  durationMs: number,
): void {
  deliveriesTotal.inc({ status, endpoint_id: endpointId })
  deliveryDurationMs.observe({ status }, durationMs)
}

export function incrementRetries(): void {
  retriesTotal.inc()
}

export function incrementDeadLettered(): void {
  deadLetteredTotal.inc()
}

export function incrementRateLimited(endpointId: string): void {
  rateLimitedDeliveries.inc({ endpoint_id: endpointId })
}

export function setProcessing(count: number): void {
  currentlyProcessing.set(count)
}

export interface HealthDeps {
  db: Database
  redis: Redis
}

/**
 * Start a tiny HTTP server exposing /metrics, /healthz, and /readyz.
 * Listens on the port defined by WORKER_METRICS_PORT env var (default 3002).
 */
export function startMetricsServer(health?: HealthDeps): void {
  if (metricsServer) return
  const port = Number.parseInt(process.env.WORKER_METRICS_PORT ?? '3002', 10)
  metricsServer = createServer(async (req, res) => {
    const url = req.url ?? ''
    if (url === '/metrics' && req.method === 'GET') {
      const body = await register.metrics()
      res.writeHead(200, { 'Content-Type': register.contentType })
      res.end(body)
    } else if (url === '/healthz' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok' }))
    } else if (url === '/readyz' && req.method === 'GET') {
      const checks: Record<string, { ok: boolean; error?: string }> = {
        database: { ok: false },
        redis: { ok: false },
      }

      if (health) {
        try {
          await health.db.execute(sql`SELECT 1`)
          checks.database = { ok: true }
        } catch (err) {
          checks.database = { ok: false, error: (err as Error).message }
        }

        try {
          const pong = await health.redis.ping()
          checks.redis = { ok: pong === 'PONG' }
        } catch (err) {
          checks.redis = { ok: false, error: (err as Error).message }
        }
      }

      const allOk = Object.values(checks).every((c) => c.ok)
      res.writeHead(allOk ? 200 : 503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: allOk ? 'ready' : 'not_ready', checks }))
    } else if (url === '/dlq/jobs' && req.method === 'GET') {
      try {
        const parsedUrl = new URL(req.url ?? '', 'http://localhost')
        const start = Number(parsedUrl.searchParams.get('start')) || 0
        const end = Number(parsedUrl.searchParams.get('end')) || 20
        const dlq = getDeadLetterQueue()
        const jobs = await dlq.getJobs(['failed', 'completed'], start, end)
        const data = await Promise.all(
          jobs.map(async (j) => ({
            id: j.id,
            name: j.name,
            data: j.data,
            attempts: j.attemptsMade,
            failedReason: j.failedReason,
            timestamp: j.timestamp,
            processedOn: j.processedOn,
            finishedOn: j.finishedOn,
          })),
        )
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ data, total: jobs.length }))
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: { message: (err as Error).message } }))
      }
    } else if (url === '/dlq/replay' && req.method === 'POST') {
      try {
        let body = ''
        for await (const chunk of req) {
          body += chunk
        }
        const { jobId } = JSON.parse(body) as { jobId?: string }
        if (!jobId) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: { message: 'jobId is required' } }))
          return
        }
        const dlq = getDeadLetterQueue()
        const job = await dlq.getJob(jobId)
        if (!job) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: { message: 'Job not found' } }))
          return
        }
        const jobData = job.data as { messageId: string; requestId?: string }
        const deliveryQueue = getDeliveryQueue()
        await deliveryQueue.add('deliver', { messageId: jobData.messageId, requestId: jobData.requestId }, {
          attempts: 1,
          removeOnComplete: 1000,
          removeOnFail: 5000,
        })
        await job.remove()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, messageId: jobData.messageId }))
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: { message: (err as Error).message } }))
      }
    } else {
      res.writeHead(404)
      res.end('Not found')
    }
  })
  metricsServer.listen(port, () => {
    getLogger().info({ port }, 'Worker metrics server listening')
  })
}

export function stopMetricsServer(): void {
  if (metricsServer) {
    metricsServer.close()
    metricsServer = null
  }
}

const QUEUE_METRICS_INTERVAL_MS = 15_000

/**
 * Periodically polls BullMQ queue stats and updates Prometheus gauges.
 */
export function startQueueMetricsCollection(deliveryQueue: Queue): () => void {
  const timer = setInterval(async () => {
    try {
      const counts = await deliveryQueue.getJobCounts()
      const states = ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'] as const
      for (const state of states) {
        queueJobCounts.set({ queue: 'webhook-delivery', state }, counts[state] ?? 0)
      }

      const workers = await deliveryQueue.getWorkersCount()
      queueWorkersCount.set({ queue: 'webhook-delivery' }, workers)
    } catch (err) {
      getLogger().error({ err: String(err) }, 'Failed to collect queue metrics')
    }
  }, QUEUE_METRICS_INTERVAL_MS)

  // Run once immediately
  deliveryQueue
    .getJobCounts()
    .then((counts) => {
      const states = ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'] as const
      for (const state of states) {
        queueJobCounts.set({ queue: 'webhook-delivery', state }, counts[state] ?? 0)
      }
      return deliveryQueue.getWorkersCount()
    })
    .then((workers) => {
      queueWorkersCount.set({ queue: 'webhook-delivery' }, workers)
    })
    .catch((err) => {
      getLogger().error({ err: String(err) }, 'Failed to collect initial queue metrics')
    })

  return () => clearInterval(timer)
}
