/**
 * Create an admin account. Public sign-up is closed, so run this once to create
 * the first admin; that admin then adds other users from the in-app admin page.
 *
 *   yarn admin:create
 *
 * Prompts for a username and password (the password is not echoed). For
 * non-interactive use, set QL_USERNAME and QL_PASSWORD instead.
 */
import { auth } from '../auth.js'
import { client } from '../db/index.js'
import { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'

type MutableInterface = { _writeToOutput: (s: string) => void }

async function prompt(question: string, { hidden = false } = {}) {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true })
  if (hidden) {
    // Echo the question but not the characters typed after it.
    const write = (rl as unknown as MutableInterface)._writeToOutput.bind(rl)
    ;(rl as unknown as MutableInterface)._writeToOutput = (s) => {
      if (s.startsWith(question) || s === '\r\n' || s === '\n') write(s)
    }
  }
  const answer = await rl.question(question)
  rl.close()
  if (hidden) stdout.write('\n')
  return answer.trim()
}

const displayUsername = process.env.QL_USERNAME ?? (await prompt('Admin username: '))
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
  if (!/^[a-zA-Z0-9_.]{3,30}$/.test(displayUsername)) {
    throw new Error('Username must be 3-30 characters: letters, numbers, "_" or "."')
  }
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters')
  }
  // Usernames are matched case-insensitively at sign-in, so store them lowercased.
  const username = displayUsername.toLowerCase()
  await auth.api.createUser({
    body: {
      // Better Auth requires an email; this app signs in by username only.
      email: `${username}@qwerty.local`,
      name: displayUsername,
      password,
      role: 'admin',
      data: { username, displayUsername },
    },
  })
  console.log(`Created admin "${displayUsername}"`)
} catch (error) {
  console.error('Could not create admin:', error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await client.end()
}
