import type { Database } from '@relay/db/client'
import { endpoints } from '@relay/db/schema'
import { and, eq, isNull } from 'drizzle-orm'

const CIRCUIT_PREFIX = 'circuit:endpoint:'
const PROBE_PREFIX = 'probe:circuit:endpoint:'

export function getCircuitKey(endpointId: string): string {
  return `${CIRCUIT_PREFIX}${endpointId}`
}

/**
 * Record a successful delivery. Resets the circuit breaker.
 */
export async function recordSuccess(
  redis: { del: (key: string) => Promise<unknown> },
  endpointId: string,
): Promise<void> {
  await redis.del(getCircuitKey(endpointId))
}

/**
 * Record a failed delivery. If consecutive failures exceed the threshold,
 * auto-pause the endpoint in the database.
 * Uses the cooldown period as the Redis key TTL so the breaker can later
 * transition to half-open.
 * Returns true if the circuit breaker tripped.
 */
export async function recordFailure(
  redis: {
    incr: (key: string) => Promise<number>
    expire: (key: string, seconds: number) => Promise<unknown>
  },
  db: Database,
  endpointId: string,
  threshold: number,
  cooldownSeconds = 300,
): Promise<boolean> {
  const key = getCircuitKey(endpointId)
  const count = await redis.incr(key)

  if (count === 1) {
    await redis.expire(key, cooldownSeconds)
  }

  if (count >= threshold) {
    await db
      .update(endpoints)
      .set({ status: 'paused', updatedAt: new Date() })
      .where(
        and(
          eq(endpoints.id, endpointId),
          eq(endpoints.status, 'active'),
          isNull(endpoints.deletedAt),
        ),
      )
    return true
  }

  return false
}

/**
 * Check if the circuit breaker's cooldown has expired for a paused endpoint.
 * When true, a single probe delivery should be allowed.
 */
export async function isCircuitKeyExpired(
  redis: { get: (key: string) => Promise<string | null> },
  endpointId: string,
): Promise<boolean> {
  const val = await redis.get(getCircuitKey(endpointId))
  return val === null
}

/**
 * Acquire a short-lived probe lock to prevent concurrent probe deliveries.
 * Returns false if another probe is already in-flight.
 */
export async function tryAcquireProbeLock(
  redis: { set: (key: string, ...args: any[]) => Promise<unknown> },
  endpointId: string,
  lockTtlSeconds = 10,
): Promise<boolean> {
  const lockKey = `${PROBE_PREFIX}${endpointId}`
  const result = await redis.set(lockKey, '1', 'EX', lockTtlSeconds)
  return result !== null
}

/**
 * Close the circuit after a successful probe delivery.
 * Unpauses the endpoint and clears all circuit-related Redis keys.
 */
export async function closeCircuit(
  redis: { del: (key: string) => Promise<unknown> },
  db: Database,
  endpointId: string,
): Promise<void> {
  await redis.del(getCircuitKey(endpointId))
  await redis.del(`${PROBE_PREFIX}${endpointId}`)
  await db
    .update(endpoints)
    .set({ status: 'active', updatedAt: new Date() })
    .where(
      and(
        eq(endpoints.id, endpointId),
        eq(endpoints.status, 'paused'),
        isNull(endpoints.deletedAt),
      ),
    )
}

/**
 * Re-open the circuit after a failed probe delivery.
 * Resets the failure counter to 1 with a fresh cooldown TTL.
 */
export async function reopenCircuit(
  redis: {
    set: (key: string, ...args: any[]) => Promise<unknown>
    del: (key: string) => Promise<unknown>
  },
  db: Database,
  endpointId: string,
  cooldownSeconds: number,
): Promise<void> {
  const key = getCircuitKey(endpointId)
  await redis.set(key, '1', 'EX', cooldownSeconds)
  await redis.del(`${PROBE_PREFIX}${endpointId}`)
}
