import { loadEnv } from '@relay/config'
import type { Database } from '@relay/db/client'
import { attempts, endpoints, messages, signingKeys } from '@relay/db/schema'
import type { Job } from 'bullmq'
import { and, eq, isNull } from 'drizzle-orm'
import {
  closeCircuit,
  isCircuitKeyExpired,
  recordFailure,
  recordSuccess,
  reopenCircuit,
  tryAcquireProbeLock,
} from './circuit-breaker.js'
import type { Logger } from './logger.js'
import {
  incrementDeadLettered,
  incrementRateLimited,
  incrementRetries,
  recordDelivery,
} from './metrics.js'
import { type DeadLetterJob, type DeliveryJob, getConnection, getDeadLetterQueue, getDeliveryQueue } from './queue.js'
import { signPayload } from './sign.js'
import { validateUrl } from './ssrf.js'

const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_seconds = tonumber(ARGV[2])
local current = redis.call('INCR', key)
if current == 1 then
  redis.call('EXPIRE', key, window_seconds * 3)
end
return current
`

/**
 * Sliding window rate limit check using an atomic Lua script.
 * Returns { allowed, resetAfterMs }.
 */
async function checkEndpointRateLimit(
  key: string,
  limit: number,
  windowSeconds = 1,
): Promise<{ allowed: boolean; resetAfterMs: number }> {
  const redis = getConnection()
  const windowMs = windowSeconds * 1000
  const windowKey = `ratelimit:endpoint:${key}:${Math.floor(Date.now() / windowMs)}`
  const current = (await redis.eval(
    RATE_LIMIT_SCRIPT,
    1,
    windowKey,
    limit,
    windowSeconds,
  )) as number
  return {
    allowed: current <= limit,
    resetAfterMs: windowMs - (Date.now() % windowMs),
  }
}

export async function processDelivery(
  job: Job<DeliveryJob>,
  deps: { db: Database; log: Logger },
): Promise<void> {
  const { messageId, requestId } = job.data
  const { db, log } = deps
  const env = loadEnv()
  const start = performance.now()
  log.info({ messageId, requestId, attempt: job.attemptsMade + 1 }, 'Processing delivery')

  // Load message + endpoint + active signing key
  const [row] = await db
    .select({ message: messages, endpoint: endpoints, signingKey: signingKeys })
    .from(messages)
    .innerJoin(endpoints, eq(messages.endpointId, endpoints.id))
    .innerJoin(
      signingKeys,
      and(
        eq(signingKeys.endpointId, endpoints.id),
        eq(signingKeys.status, 'active'),
        eq(signingKeys.secret, endpoints.secret),
      ),
    )
    .where(and(eq(messages.id, messageId), isNull(endpoints.deletedAt)))
    .limit(1)

  if (!row) {
    log.warn({ messageId }, 'Message or endpoint not found, skipping')
    return
  }

  const { message, endpoint, signingKey } = row

  // Half-open probe: allow a single delivery if the endpoint is paused
  // and the circuit breaker's cooldown has expired.
  let isProbe = false
  if (endpoint.status === 'paused') {
    const cooldownExpired = await isCircuitKeyExpired(getConnection(), endpoint.id)
    if (cooldownExpired) {
      const locked = await tryAcquireProbeLock(getConnection(), endpoint.id)
      if (locked) {
        isProbe = true
        log.info(
          { messageId, endpointId: endpoint.id },
          'Half-open probe: allowing delivery for paused endpoint',
        )
      }
    }
  }

  if (endpoint.status !== 'active' && !isProbe) {
    log.info({ messageId, status: endpoint.status }, 'Endpoint not active, marking failed')
    await db
      .update(messages)
      .set({
        status: 'failed',
        lastError: `Endpoint ${endpoint.status}`,
        updatedAt: new Date(),
      })
      .where(eq(messages.id, messageId))
    return
  }

  // Check endpoint-level rate limits before dispatching
  const perSecondLimit = endpoint.rateLimitPerSecond ?? env.RATE_LIMIT_PER_SECOND
  const burstLimit = endpoint.rateLimitBurst ?? env.RATE_LIMIT_BURST

  const [perSecResult, burstResult] = await Promise.all([
    checkEndpointRateLimit(`${endpoint.id}:sec`, perSecondLimit, 1),
    checkEndpointRateLimit(`${endpoint.id}:burst`, burstLimit, 10),
  ])

  if (!perSecResult.allowed || !burstResult.allowed) {
    const delay = Math.max(perSecResult.resetAfterMs, burstResult.resetAfterMs) + 100
    incrementRateLimited(endpoint.id)
    log.warn(
      { messageId, requestId, endpointId: endpoint.id, delay, perSecondLimit, burstLimit },
      'Rate limited at dispatch, re-queuing with delay',
    )
    await db
      .update(messages)
      .set({ status: 'pending', updatedAt: new Date() })
      .where(eq(messages.id, messageId))
    const retryQueue = getDeliveryQueue()
    await retryQueue.add(
      'deliver',
      { messageId, requestId },
      { delay, attempts: 1, removeOnComplete: 1000, removeOnFail: 5000 },
    )
    return
  }

  await db
    .update(messages)
    .set({ status: 'processing', updatedAt: new Date() })
    .where(eq(messages.id, messageId))

  const body = JSON.stringify({
    id: message.id,
    event_id: message.eventId,
    event_type: message.eventType,
    payload: message.payload,
    created_at: message.createdAt.toISOString(),
  })

  const secret = signingKey?.secret ?? endpoint.secret
  const kid = signingKey?.kid ?? 'v1'
  const signed = signPayload({ secret, body })
  const requestHeaders: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': env.WEBHOOK_USER_AGENT,
    'x-relay-message-id': message.id,
    'x-relay-event-id': message.eventId,
    'x-relay-event-type': message.eventType,
    'x-relay-signature': `${signed.header},kid=${kid}`,
    'x-relay-attempt': String(job.attemptsMade + 1),
    ...(requestId ? { 'x-relay-request-id': requestId } : {}),
  }

  const timeoutMs = endpoint.timeoutMs ?? env.WEBHOOK_TIMEOUT_MS
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const attemptedAt = new Date()
  let httpStatus: number | null = null
  let responseBody: string | null = null
  let responseHeaders: Record<string, string> | null = null
  let errorMessage: string | null = null
  let attemptStatus: 'success' | 'failed' | 'timeout' | 'connection_error' = 'failed'
  let success = false

  try {
    await validateUrl(endpoint.url)
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: requestHeaders,
      body,
      signal: controller.signal,
    })
    httpStatus = res.status
    responseHeaders = Object.fromEntries(res.headers.entries())
    responseBody = (await res.text()).slice(0, 8192)
    if (res.ok) {
      attemptStatus = 'success'
      success = true
    } else {
      attemptStatus = 'failed'
      errorMessage = `HTTP ${res.status}`
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      attemptStatus = 'timeout'
      errorMessage = `Timeout after ${timeoutMs}ms`
    } else {
      attemptStatus = 'connection_error'
      errorMessage = (err as Error).message
    }
  } finally {
    clearTimeout(timeout)
  }

  const durationMs = Math.round(performance.now() - start)
  const attemptNumber = message.attemptCount + 1

  await db.insert(attempts).values({
    messageId,
    attemptNumber,
    status: attemptStatus,
    httpStatus,
    responseBody,
    responseHeaders,
    durationMs,
    errorMessage,
    attemptedAt,
    requestUrl: endpoint.url,
    requestHeaders,
    requestId: requestId ?? null,
  })

  if (success) {
    await db
      .update(messages)
      .set({
        status: 'delivered',
        attemptCount: attemptNumber,
        deliveredAt: new Date(),
        updatedAt: new Date(),
        lastError: null,
      })
      .where(eq(messages.id, messageId))
    recordDelivery(attemptStatus, endpoint.id, durationMs)
    log.info({ messageId, status: httpStatus, durationMs, attempt: attemptNumber }, 'Delivered')
    if (isProbe) {
      await closeCircuit(getConnection(), db, endpoint.id)
      log.info({ messageId, endpointId: endpoint.id }, 'Probe succeeded — circuit closed, endpoint unpaused')
    } else {
      await recordSuccess(getConnection(), endpoint.id)
    }
    return
  }

  const newAttemptCount = attemptNumber
  const isFinal = newAttemptCount >= env.WEBHOOK_MAX_ATTEMPTS
  const status: 'dead_letter' | 'pending' = isFinal ? 'dead_letter' : 'pending'
  const schedule = env.WEBHOOK_RETRY_SCHEDULE
  const nextDelay = isFinal
    ? null
    : (schedule[Math.min(newAttemptCount - 1, schedule.length - 1)] ?? 3600)
  const nextRetryAt = nextDelay ? new Date(Date.now() + nextDelay * 1000) : null

  await db
    .update(messages)
    .set({
      status,
      attemptCount: newAttemptCount,
      lastError: errorMessage,
      nextRetryAt,
      updatedAt: new Date(),
    })
    .where(eq(messages.id, messageId))

  recordDelivery(attemptStatus, endpoint.id, durationMs)

  if (isFinal) {
    incrementDeadLettered()
    const cooldownSeconds = Math.ceil(env.CIRCUIT_BREAKER_COOLDOWN_MS / 1000)
    let circuitTripped = false
    if (isProbe) {
      await reopenCircuit(getConnection(), db, endpoint.id, cooldownSeconds)
      circuitTripped = true
      log.info(
        { messageId, endpointId: endpoint.id },
        'Probe failed — circuit re-opened with fresh cooldown',
      )
    } else {
      circuitTripped = await recordFailure(
        getConnection(),
        db,
        endpoint.id,
        env.CIRCUIT_BREAKER_THRESHOLD,
        cooldownSeconds,
      )
    }
    log.warn(
      { messageId, requestId, attempts: newAttemptCount, lastError: errorMessage, circuitTripped },
      'Dead-lettered after max attempts',
    )

    // Push to dead-letter queue for inspection and replay
    const dlJob: DeadLetterJob = {
      messageId: message.id,
      endpointId: endpoint.id,
      endpointUrl: endpoint.url,
      eventId: message.eventId,
      eventType: message.eventType,
      lastError: errorMessage,
      lastHttpStatus: httpStatus,
      attempts: newAttemptCount,
      requestId,
      deadLetteredAt: new Date().toISOString(),
    }
    try {
      await getDeadLetterQueue().add('dead-letter', dlJob, {
        removeOnComplete: 5000,
        removeOnFail: 1000,
      })
    } catch (err) {
      log.warn({ messageId, error: (err as Error).message }, 'Failed to push to dead-letter queue')
    }

    // Fire dead-letter webhook if configured
    if (endpoint.deadLetterWebhookUrl) {
      const dlPayload = JSON.stringify({
        event: 'message.dead_letter',
        message_id: message.id,
        event_id: message.eventId,
        event_type: message.eventType,
        endpoint_id: endpoint.id,
        endpoint_url: endpoint.url,
        attempts: newAttemptCount,
        last_error: errorMessage,
        last_http_status: httpStatus,
        created_at: message.createdAt.toISOString(),
        dead_lettered_at: new Date().toISOString(),
      });
      (async () => {
        try {
          await validateUrl(endpoint.deadLetterWebhookUrl!)
          await fetch(endpoint.deadLetterWebhookUrl!, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'user-agent': env.WEBHOOK_USER_AGENT,
            },
            body: dlPayload,
            signal: AbortSignal.timeout(5000),
          })
        } catch (err) {
          log.warn(
            { messageId, deadLetterWebhookUrl: endpoint.deadLetterWebhookUrl, error: (err as Error).message },
            'Dead-letter webhook call failed',
          )
        }
      })()
    }

    return
  }

  // Schedule delayed retry with full jitter to avoid thundering herd
  const retryQueue = getDeliveryQueue()
  const baseDelay = (nextDelay ?? 60) * 1000
  const jitteredDelay = Math.round(baseDelay * (0.5 + Math.random() * 0.5))
    await retryQueue.add(
      'deliver',
      { messageId, requestId },
      {
        delay: jitteredDelay,
        attempts: 1,
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    )
    incrementRetries()
    // Don't close retryQueue — it's reused

    log.info(
      { messageId, requestId, attempt: newAttemptCount, nextRetryAt, jitteredDelay, lastError: errorMessage },
      'Scheduled retry with jitter',
    )
}
