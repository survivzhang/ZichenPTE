import { auth } from './auth.js'
import { db } from './db/index.js'
import { chapterRecord, wordRecord } from './db/schema.js'
import { Hono } from 'hono'
import { z } from 'zod'

type Env = { Variables: { userId: string } }

const unixSeconds = z
  .number()
  .int()
  .nonnegative()
  .transform((s) => new Date(s * 1000))

const wordRecordInput = z.object({
  word: z.string().min(1).max(200),
  dict: z.string().min(1).max(200),
  chapter: z.number().int().nullable(),
  timing: z.array(z.number()),
  wrongCount: z.number().int().nonnegative(),
  mistakes: z.record(z.string(), z.array(z.string())),
  timeStamp: unixSeconds,
})

const chapterRecordInput = z.object({
  dict: z.string().min(1).max(200),
  chapter: z.number().int().nullable(),
  time: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
  wrongCount: z.number().int().nonnegative(),
  wordCount: z.number().int().nonnegative(),
  correctWordIndexes: z.array(z.number().int()),
  wordNumber: z.number().int().nonnegative(),
  timeStamp: unixSeconds,
})

const app = new Hono<Env>().basePath('/api')

app.on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))

// Everything below requires a signed-in user.
app.use('/records/*', async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  c.set('userId', session.user.id)
  await next()
})

app.post('/records/words', async (c) => {
  const parsed = wordRecordInput.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: 'Invalid word record', issues: parsed.error.issues }, 400)
  }
  const { timeStamp, ...record } = parsed.data
  const [row] = await db
    .insert(wordRecord)
    .values({ ...record, typedAt: timeStamp, userId: c.get('userId') })
    .returning({ id: wordRecord.id })
  return c.json(row, 201)
})

app.post('/records/chapters', async (c) => {
  const parsed = chapterRecordInput.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: 'Invalid chapter record', issues: parsed.error.issues }, 400)
  }
  const { timeStamp, ...record } = parsed.data
  const [row] = await db
    .insert(chapterRecord)
    .values({ ...record, typedAt: timeStamp, userId: c.get('userId') })
    .returning({ id: chapterRecord.id })
  return c.json(row, 201)
})

export default app
