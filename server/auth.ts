import { db } from './db/index.js'
import * as schema from './db/schema.js'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, username } from 'better-auth/plugins'

const DAY = 60 * 60 * 24

// Vercel exposes the deployment's hostnames; trust them so preview deployments work too.
const vercelOrigins = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
  .filter(Boolean)
  .map((host) => `https://${host}`)

/**
 * Public sign-up is closed. The first admin is created with `yarn admin:create`;
 * after that, admins add everyone else from the in-app admin page.
 */
export const auth = betterAuth({
  basePath: '/api/auth',
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
  },
  plugins: [username(), admin()],
  session: {
    // Stay signed in: the session lasts a year and is extended once a day while in use.
    expiresIn: 365 * DAY,
    updateAge: DAY,
  },
  rateLimit: {
    enabled: true,
    storage: 'database',
    customRules: {
      '/sign-in/username': { window: 60, max: 5 },
    },
  },
  trustedOrigins: vercelOrigins,
})
