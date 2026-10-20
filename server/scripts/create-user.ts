/**
 * Create the account that can sign in to the app. Sign-up is closed in the
 * app itself, so this is the only way to add a user.
 *
 *   yarn user:create
 *
 * Prompts for a username and password. For non-interactive use, set
 * QL_USERNAME and QL_PASSWORD instead.
 */
import { createAuth } from '../auth.js'
import { client } from '../db/index.js'
import { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'

async function prompt(question: string, { hidden = false } = {}) {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true })
  if (hidden) {
    // Echo the question but not the characters typed after it.
    const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput.bind(rl)
    ;(rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => {
      if (s.startsWith(question) || s === '\r\n' || s === '\n') write(s)
    }
  }
  const answer = await rl.question(question)
  rl.close()
  if (hidden) stdout.write('\n')
  return answer.trim()
}

const username = process.env.QL_USERNAME ?? (await prompt('Username: '))
let password = process.env.QL_PASSWORD
if (!password) {
  password = await prompt('Password (min 8 characters): ', { hidden: true })
  const confirm = await prompt('Confirm password: ', { hidden: true })
  if (password !== confirm) {
    console.error('Passwords do not match')
    process.exit(1)
  }
}

try {
  const auth = createAuth({ allowSignUp: true })
  await auth.api.signUpEmail({
    body: {
      // Better Auth requires an email; this app signs in by username only.
      email: `${username.toLowerCase()}@qwerty.local`,
      name: username,
      username,
      password,
    },
  })
  console.log(`Created user "${username}"`)
} catch (error) {
  console.error('Could not create user:', error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await client.end()
}
