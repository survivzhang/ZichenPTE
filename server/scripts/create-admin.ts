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

async function prompt(question: string) {
  const rl = createInterface({ input: stdin, output: stdout })
  const answer = await rl.question(question)
  rl.close()
  return answer.trim()
}

/** Read a line without echoing it, so the password never shows on screen. */
function promptHidden(question: string): Promise<string> {
  stdout.write(question)
  if (!stdin.isTTY) {
    // Piped input (e.g. scripts): nothing is echoed anyway, just read a line.
    return prompt('')
  }
  return new Promise((resolve) => {
    let value = ''
    const finish = () => {
      stdin.off('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
      stdout.write('\n')
    }
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') {
          finish()
          resolve(value)
          return
        }
        if (ch === '\u0003') {
          // Ctrl+C
          finish()
          process.exit(130)
        }
        if (ch === '\u007f' || ch === '\b') {
          value = value.slice(0, -1)
        } else {
          value += ch
        }
      }
    }
    stdin.setEncoding('utf8')
    stdin.setRawMode(true)
    stdin.resume()
    stdin.on('data', onData)
  })
}

const displayUsername = process.env.QL_USERNAME ?? (await prompt('Admin username: '))
let password = process.env.QL_PASSWORD
if (!password) {
  password = await promptHidden('Password (min 8 characters): ')
  const confirm = await promptHidden('Confirm password: ')
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
