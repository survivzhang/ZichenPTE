/**
 * Import a JSON file for one user, using the same functions as the /api/v1
 * import endpoints: FIB / WFD go into the question bank (chapters by import
 * date), words straight into the error words review. Shape: { fib: [{sentence, trans?, note?}],
 * wfd: [{sentence, trans?, note?}], words: [{word, trans?, usphone?, ukphone?, source?, note?}] }
 *
 *   tsx --env-file=<env> server/scripts/import-json.ts <username> <file.json>
 */
import { importBankItems } from '../bank.js'
import { client, db } from '../db/index.js'
import { user } from '../db/schema.js'
import { importWords, parseFib } from '../srs.js'
import type { CardSource } from '../srs.js'
import { eq } from 'drizzle-orm'
import { readFileSync } from 'node:fs'

const [username, file] = process.argv.slice(2)
if (!username || !file) {
  console.error('usage: import-json.ts <username> <file.json>')
  process.exit(1)
}

type Sentence = { sentence: string; trans?: string | string[]; note?: string }
type Word = {
  word: string
  trans?: string | string[]
  usphone?: string | null
  ukphone?: string | null
  source?: CardSource
  note?: string
}
const data = JSON.parse(readFileSync(file, 'utf8')) as { fib?: Sentence[]; wfd?: Sentence[]; words?: Word[] }
const asList = (t?: string | string[]) => (t === undefined ? undefined : Array.isArray(t) ? t : [t])

try {
  console.log(`Database: ${new URL(process.env.DATABASE_URL ?? '').hostname}`)
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.username, username.toLowerCase()))
  if (!row) throw new Error(`Unknown username: ${username}`)

  const badFib = (data.fib ?? []).filter((item) => !parseFib(item.sentence))
  if (badFib.length) throw new Error(`FIB sentences need exactly one [blank]: ${badFib.map((b) => b.sentence).join(' | ')}`)

  const fib = await importBankItems(
    row.id,
    'fib',
    (data.fib ?? []).map((s) => ({ ...s, trans: asList(s.trans) })),
  )
  const wfd = await importBankItems(
    row.id,
    'wfd',
    (data.wfd ?? []).map((s) => ({ ...s, trans: asList(s.trans) })),
  )
  const words = await importWords(
    row.id,
    (data.words ?? []).map((w) => ({ ...w, trans: asList(w.trans) })),
  )
  console.log('fib', fib, '| wfd', wfd, '| words', words)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await client.end()
}
