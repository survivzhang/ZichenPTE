import { auth } from './auth.js'
import { db } from './db/index.js'
import { chapterRecord, userPreference, wordRecord } from './db/schema.js'
import { and, eq, gte } from 'drizzle-orm'
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
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

const preferencesInput = z.object({
  currentDict: z.string().min(1).max(200),
  currentChapter: z.number().int().nonnegative(),
})

const requireUser = createMiddleware<Env>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  c.set('userId', session.user.id)
  await next()
})

const app = new Hono<Env>().basePath('/api')

app.on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))

// Everything below requires a signed-in user.
app.use('/records/*', requireUser)
app.use('/preferences', requireUser)
app.use('/progress', requireUser)

// Chapters of a dictionary the user has finished at least once (review sessions excluded).
app.get('/progress', async (c) => {
  const dict = c.req.query('dict')
  if (!dict || dict.length > 200) {
    return c.json({ error: 'Missing dict' }, 400)
  }
  const rows = await db
    .selectDistinct({ chapter: chapterRecord.chapter })
    .from(chapterRecord)
    .where(and(eq(chapterRecord.userId, c.get('userId')), eq(chapterRecord.dict, dict), gte(chapterRecord.chapter, 0)))
  return c.json({ completedChapters: rows.map((row) => row.chapter).sort((a, b) => (a ?? 0) - (b ?? 0)) })
})

app.get('/preferences', async (c) => {
  const [row] = await db
    .select({ currentDict: userPreference.currentDict, currentChapter: userPreference.currentChapter })
    .from(userPreference)
    .where(eq(userPreference.userId, c.get('userId')))
  return c.json(row ?? { currentDict: null, currentChapter: null })
})

app.put('/preferences', async (c) => {
  const parsed = preferencesInput.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: 'Invalid preferences', issues: parsed.error.issues }, 400)
  }
  await db
    .insert(userPreference)
    .values({ userId: c.get('userId'), ...parsed.data })
    .onConflictDoUpdate({ target: userPreference.userId, set: parsed.data })
  return c.json(parsed.data)
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
