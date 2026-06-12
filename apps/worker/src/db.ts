import { loadEnv } from '@relay/config'
import { type Database, createDatabase } from '@relay/db/client'

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
