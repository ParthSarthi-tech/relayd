import type { Logger } from './logger.js'

type NotificationHandler = (payload: string) => void

const subscribers = new Set<NotificationHandler>()
let listening = false
let unlistenFn: (() => Promise<void>) | null = null

/**
 * Start listening for Postgres NOTIFY events on the relay_events channel.
 * Uses the underlying postgres.js client from the Drizzle database handle.
 * Fans out received notifications to all subscribers.
 */
export async function startNotificationListener(
  db: any,
  log: Logger,
): Promise<void> {
  if (listening) return
  listening = true

  try {
    const client = (db as any).$client as any
    const result = await client.listen('relay_events', (payload: string) => {
      for (const handler of subscribers) {
        try {
          handler(payload)
        } catch {
          // Per-handler errors must not break the loop
        }
      }
    })
    unlistenFn = typeof result?.unlisten === 'function' ? result.unlisten : null
    log.info('Notification listener started on relay_events channel')
  } catch (err) {
    listening = false
    log.error({ err: String(err) }, 'Failed to start notification listener')
  }
}

/**
 * Stop listening and release the database connection.
 */
export async function stopNotificationListener(): Promise<void> {
  if (unlistenFn) {
    await unlistenFn()
    unlistenFn = null
  }
  listening = false
  subscribers.clear()
}

/**
 * Subscribe to message change notifications.
 * Returns an unsubscribe function.
 */
export function subscribeToNotifications(handler: NotificationHandler): () => void {
  subscribers.add(handler)
  return () => {
    subscribers.delete(handler)
  }
}
