import { loadEnv } from '@relay/config'
import { createDatabase } from '@relay/db/client'
import type { Database } from '@relay/db/client'

let db: Database | undefined

export function getDatabase(): Database {
  if (!db) {
    const env = loadEnv()
    db = createDatabase({
      url: env.DATABASE_URL,
      min: env.DATABASE_POOL_MIN,
      max: env.DATABASE_POOL_MAX,
    })
  }
  return db
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    // postgres-js exposes a `end` method on the underlying client
    await (db as unknown as { $client: { end: () => Promise<void> } }).$client.end()
    db = undefined
  }
}

export type { Database }
