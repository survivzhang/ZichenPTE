import app from './app.js'
import { serve } from '@hono/node-server'

const port = Number(process.env.API_PORT ?? 3001)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`)
})
