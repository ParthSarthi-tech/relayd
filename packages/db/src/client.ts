import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

export type Database = ReturnType<typeof createDatabase>

export interface CreateDatabaseOptions {
  url: string
  min?: number
  max?: number
  idleTimeout?: number
  connectTimeout?: number
}

/**
 * Create a Drizzle database client.
 * Use a separate client per process (API, worker, migrations).
 */
export function createDatabase(options: CreateDatabaseOptions) {
  const client = postgres(options.url, {
    max: options.max ?? 10,
    idle_timeout: options.idleTimeout ?? 30,
    connect_timeout: options.connectTimeout ?? 10,
    onnotice: () => {},
  })
  return drizzle(client, { schema, logger: false })
}

/**
 * Pre-warm the pool to ensure at least `count` connections are ready.
 * postgres.js has no native minimum-pool concept, so we issue parallel
 * health checks. Call after createDatabase() at process startup.
 */
export async function prewarmPool(
  db: Database,
  count: number,
  max: number,
): Promise<void> {
  const actual = Math.min(count, max)
  if (actual <= 0) return
  const client = (db as unknown as { $client: ReturnType<typeof postgres> }).$client
  await Promise.all(
    Array.from({ length: actual }, () => client`SELECT 1`),
  )
}

export { schema }
