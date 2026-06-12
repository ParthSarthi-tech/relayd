import { loadEnv } from '@relay/config'
import { type Job, Queue, Worker } from 'bullmq'
import IORedis, { type Redis } from 'ioredis'

export const DELIVERY_QUEUE_NAME = 'webhook-delivery'
export const DEAD_LETTER_QUEUE_NAME = 'webhook-dead-letter'

let connection: Redis | undefined
let deliveryQueue: Queue | undefined
let deadLetterQueue: Queue | undefined

export function getConnection(): Redis {
  if (!connection) {
    const env = loadEnv()
    connection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
  }
  return connection
}

export function getDeliveryQueue(): Queue {
  if (!deliveryQueue) {
    deliveryQueue = new Queue(DELIVERY_QUEUE_NAME, { connection: getConnection() })
  }
  return deliveryQueue
}

export function getDeadLetterQueue(): Queue {
  if (!deadLetterQueue) {
    deadLetterQueue = new Queue(DEAD_LETTER_QUEUE_NAME, { connection: getConnection() })
  }
  return deadLetterQueue
}

export type DeliveryJob = { messageId: string; requestId?: string }

export interface DeadLetterJob {
  messageId: string
  endpointId: string
  endpointUrl: string
  eventId: string
  eventType: string
  lastError: string | null
  lastHttpStatus: number | null
  attempts: number
  requestId?: string
  deadLetteredAt: string
}

export interface CreateWorkerOptions {
  processor: (job: Job<DeliveryJob>) => Promise<void>
  concurrency?: number
}

export function createDeliveryWorker(opts: CreateWorkerOptions): Worker<DeliveryJob> {
  const env = loadEnv()
  return new Worker<DeliveryJob>(DELIVERY_QUEUE_NAME, opts.processor, {
    connection: getConnection(),
    concurrency: opts.concurrency ?? env.WORKER_CONCURRENCY,
  })
}
