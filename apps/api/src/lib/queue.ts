import { loadEnv } from '@relay/config'
import { Queue } from 'bullmq'
import IORedis, { type Redis } from 'ioredis'

export const DELIVERY_QUEUE_NAME = 'webhook-delivery'

export interface Queues {
  delivery: Queue
  connection: Redis
}

let queues: Queues | undefined

export function getQueues(): Queues {
  if (queues) return queues
  const env = loadEnv()
  const connection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
  })
  const delivery = new Queue(DELIVERY_QUEUE_NAME, { connection })
  queues = { delivery, connection }
  return queues
}

export async function closeQueues(): Promise<void> {
  if (queues) {
    await queues.delivery.close()
    await queues.connection.quit()
    queues = undefined
  }
}
