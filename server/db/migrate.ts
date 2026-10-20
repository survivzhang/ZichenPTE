import { client, db } from './index.js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { fileURLToPath } from 'node:url'

await migrate(db, { migrationsFolder: fileURLToPath(new URL('./migrations', import.meta.url)) })
console.log('Database migrations applied')
await client.end()
