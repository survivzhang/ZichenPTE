// Vercel Function entry point. vercel.json rewrites every /api/* request here,
// and the Hono app routes on the original path.
import app from '../server/app.js'
import { handle } from 'hono/vercel'

const handler = handle(app)

export const GET = handler
export const POST = handler
