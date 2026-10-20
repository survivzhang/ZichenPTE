import { db } from './db/index.js'
import * as schema from './db/schema.js'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { username } from 'better-auth/plugins'

const DAY = 60 * 60 * 24

// Vercel exposes the deployment's hostnames; trust them so preview deployments work too.
const vercelOrigins = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
  .filter(Boolean)
  .map((host) => `https://${host}`)

/**
 * Sign-up is closed: the app is private, so accounts are only created with
 * `yarn user:create`, which builds an instance with `allowSignUp: true`.
 */
export function createAuth({ allowSignUp = false } = {}) {
  return betterAuth({
    basePath: '/api/auth',
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !allowSignUp,
      // Accounts are created from the CLI, which has no use for a session.
      autoSignIn: false,
      minPasswordLength: 8,
    },
    plugins: [username()],
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
}

export const auth = createAuth()
