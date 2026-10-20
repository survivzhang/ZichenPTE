import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

// Run schema changes over a direct connection: Neon's DATABASE_URL goes through
// a connection pooler, and it also sets DATABASE_URL_UNPOOLED for this purpose.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (!url) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
}

const client = postgres(url, { max: 1, onnotice: () => {} })
await migrate(drizzle(client), { migrationsFolder: fileURLToPath(new URL('./migrations', import.meta.url)) })
console.log('Database migrations applied')
await client.end()
