import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://relay:relay@localhost:5432/relay'

async function main() {
  console.log('[migrate] Connecting to', DATABASE_URL.replace(/:[^:@]+@/, ':***@'))
  const client = postgres(DATABASE_URL, { max: 1 })
  const db = drizzle(client)

  console.log('[migrate] Running migrations…')
  await migrate(db, { migrationsFolder: './migrations' })
  console.log('[migrate] Done.')

  await client.end()
  process.exit(0)
}

main().catch((err) => {
  console.error('[migrate] Failed:', err)
  process.exit(1)
})
