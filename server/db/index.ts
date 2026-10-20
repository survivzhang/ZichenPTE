import * as schema from './schema.js'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
}

// Serverless functions should hold at most one connection each.
export const client = postgres(url, { max: process.env.VERCEL ? 1 : 10, prepare: false, onnotice: () => {} })
export const db = drizzle(client, { schema })
