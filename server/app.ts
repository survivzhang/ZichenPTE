import { auth } from './auth.js'
import { bankChapters, findBankItem, importBankItems } from './bank.js'
import type { BankType } from './bank.js'
import { db } from './db/index.js'
import { apiKey, chapterRecord, speakRecord, user, userPreference, wordRecord } from './db/schema.js'
import { isSpeechConfigured, speechToken } from './speech.js'
import { CARD_TYPES, dueCards, importWords, listCards, parseFib, recordAnswer, recordBankAnswer, recordSpeakAnswer } from './srs.js'
import { isTtsConfigured, synthesize } from './tts.js'
import { and, asc, between, count, countDistinct, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { z } from 'zod'

type Env = { Variables: { userId: string; role: string | null } }

const SOURCES = ['typing', 'listening', 'speaking', 'reading', 'writing', 'other'] as const

const unixSeconds = z
  .number()
  .int()
  .nonnegative()
  .transform((s) => new Date(s * 1000))

const wordRecordInput = z.object({
  // a word, a FIB answer or a whole WFD sentence
  word: z.string().min(1).max(1000),
  dict: z.string().min(1).max(200),
  chapter: z.number().int().nullable(),
  timing: z.array(z.number()),
  wrongCount: z.number().int().nonnegative(),
  mistakes: z.record(z.string(), z.array(z.string())),
  timeStamp: unixSeconds,
  // learn = a normal chapter, review = the daily FSRS review
  mode: z.enum(['learn', 'review']).default('learn'),
  trans: z.array(z.string()).optional(),
  usphone: z.string().nullish(),
  ukphone: z.string().nullish(),
  // set when the item came from a review card (daily review, FIB, WFD)
  cardId: z.number().int().positive().optional(),
  // set when the item came from the user's FIB / WFD question bank
  itemId: z.number().int().positive().optional(),
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

const speakRecordInput = z.object({
  word: z.string().min(1).max(200),
  dict: z.string().min(1).max(200),
  chapter: z.number().int().nullable(),
  // Azure accuracy score; null when marked by hand because Azure was unavailable
  score: z.number().int().min(0).max(100).nullable(),
  passed: z.boolean(),
  firstTry: z.boolean(),
  manual: z.boolean().default(false),
  locale: z.string().min(2).max(10),
  phonemes: z
    .array(z.object({ phoneme: z.string().max(20).nullable(), score: z.number().min(0).max(100) }))
    .max(100)
    .default([]),
  durationMs: z.number().int().nonnegative().nullish(),
  timeStamp: unixSeconds,
  mode: z.enum(['learn', 'review']).default('learn'),
  trans: z.array(z.string()).optional(),
  usphone: z.string().nullish(),
  ukphone: z.string().nullish(),
  cardId: z.number().int().positive().optional(),
})

const preferencesInput = z.object({
  currentDict: z.string().min(1).max(200),
  currentChapter: z.number().int().nonnegative(),
  speakDict: z.string().min(1).max(200).optional(),
  speakChapter: z.number().int().nonnegative().optional(),
})

// trans may be sent as one string ("n. 苹果; 苹果树") or a list
const transInput = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((t) => (t === undefined ? undefined : Array.isArray(t) ? t : [t]))

const importWordInput = z.object({
  word: z.string().trim().min(1).max(200),
  trans: transInput,
  usphone: z.string().max(200).nullish(),
  ukphone: z.string().max(200).nullish(),
  source: z.enum(SOURCES).default('other'),
  note: z.string().max(1000).nullish(),
})

const requireUser = createMiddleware<Env>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  c.set('userId', session.user.id)
  c.set('role', session.user.role ?? null)
  await next()
})

const requireAdmin = createMiddleware<Env>(async (c, next) => {
  if (c.get('role') !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
})

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex')

// /api/v1 is for scripts and agents: `Authorization: Bearer <api key>` issued by an admin.
const requireApiKey = createMiddleware<Env>(async (c, next) => {
  const key = c.req.header('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
  if (!key) {
    return c.json({ error: 'Missing API key: send Authorization: Bearer <key>' }, 401)
  }
  const [row] = await db
    .select({ id: apiKey.id, userId: apiKey.userId, role: user.role })
    .from(apiKey)
    .innerJoin(user, eq(user.id, apiKey.userId))
    .where(and(eq(apiKey.keyHash, hashKey(key)), isNull(apiKey.revokedAt)))
  // Keys stop working if their owner is no longer an admin.
  if (!row || row.role !== 'admin') {
    return c.json({ error: 'Invalid or revoked API key' }, 401)
  }
  await db.update(apiKey).set({ lastUsedAt: new Date() }).where(eq(apiKey.id, row.id))
  c.set('userId', row.userId)
  c.set('role', row.role)
  await next()
})

async function findUserIdByUsername(username: string) {
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.username, username.trim().toLowerCase()))
  return row?.id
}

const app = new Hono<Env>().basePath('/api')

app.on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))

// Everything below requires a signed-in user.
app.use('/records/*', requireUser)
app.use('/preferences', requireUser)
app.use('/progress', requireUser)
app.use('/stats/*', requireUser)
app.use('/bank/*', requireUser)

// The user's FIB / WFD question bank, split into chapters by import date.
app.get('/bank/:type', async (c) => {
  const type = z.enum(['fib', 'wfd']).safeParse(c.req.param('type'))
  if (!type.success) return c.json({ error: 'type must be fib or wfd' }, 400)
  return c.json({ chapters: await bankChapters(c.get('userId'), type.data) })
})

// Word records in a time range (unix seconds), for the statistics page.
app.get('/stats/words', async (c) => {
  const from = Number(c.req.query('from'))
  const to = Number(c.req.query('to'))
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
    return c.json({ error: 'from/to must be unix seconds' }, 400)
  }
  const rows = await db
    .select({
      word: wordRecord.word,
      typedAt: wordRecord.typedAt,
      timing: wordRecord.timing,
      wrongCount: wordRecord.wrongCount,
      mistakes: wordRecord.mistakes,
    })
    .from(wordRecord)
    .where(and(eq(wordRecord.userId, c.get('userId')), between(wordRecord.typedAt, new Date(from * 1000), new Date(to * 1000))))
    .orderBy(asc(wordRecord.typedAt))
  return c.json({
    records: rows.map(({ typedAt, ...row }) => ({ ...row, timeStamp: Math.floor(typedAt.getTime() / 1000) })),
  })
})

// How many distinct chapters of each dictionary have been finished, for the dictionary cards.
app.get('/stats/dicts', async (c) => {
  const rows = await db
    .select({ dict: chapterRecord.dict, chapters: countDistinct(chapterRecord.chapter) })
    .from(chapterRecord)
    .where(and(eq(chapterRecord.userId, c.get('userId')), gte(chapterRecord.chapter, 0)))
    .groupBy(chapterRecord.dict)
  return c.json({ dicts: Object.fromEntries(rows.map((row) => [row.dict, row.chapters])) })
})

// Per-chapter totals for one dictionary, for the chapter picker.
app.get('/stats/chapters', async (c) => {
  const dict = c.req.query('dict')
  if (!dict || dict.length > 200) return c.json({ error: 'Missing dict' }, 400)
  const rows = await db
    .select({
      chapter: chapterRecord.chapter,
      exerciseCount: count(),
      wrongWordTotal: sql<number>`sum(${chapterRecord.wordNumber} - jsonb_array_length(${chapterRecord.correctWordIndexes}))`.mapWith(
        Number,
      ),
      wrongInputTotal: sql<number>`sum(${chapterRecord.wrongCount})`.mapWith(Number),
    })
    .from(chapterRecord)
    .where(and(eq(chapterRecord.userId, c.get('userId')), eq(chapterRecord.dict, dict), gte(chapterRecord.chapter, 0)))
    .groupBy(chapterRecord.chapter)
  return c.json({ chapters: rows })
})
app.use('/review/*', requireUser)
app.use('/words/*', requireUser)
app.use('/api-keys', requireUser, requireAdmin)
app.use('/api-keys/*', requireUser, requireAdmin)
app.use('/v1/*', requireApiKey)

// Cards due before `before` (the end of the user's local day), oldest first. Word cards make up the
// mandatory daily review; ?type=fib|wfd gives the optional FIB/WFD suggestions.
app.get('/review/due', async (c) => {
  const before = new Date(c.req.query('before') ?? Date.now())
  const type = z.enum(CARD_TYPES).default('word').safeParse(c.req.query('type'))
  if (Number.isNaN(before.getTime()) || !type.success) {
    return c.json({ error: 'Invalid before or type' }, 400)
  }
  const cards = await dueCards(c.get('userId'), type.data, before)
  return c.json({ count: cards.length, cards })
})

// Every review card with its answer history (the error book).
app.get('/review/cards', async (c) => {
  const type = z.enum(CARD_TYPES).optional().safeParse(c.req.query('type'))
  if (!type.success) return c.json({ error: 'Invalid type' }, 400)
  return c.json({ cards: await listCards(c.get('userId'), type.data) })
})

// Speech for a sentence or phrase (Azure, cached). 503 when not configured: the client then uses the browser's voice.
app.get('/tts', requireUser, async (c) => {
  const text = (c.req.query('text') ?? '').trim()
  if (!text || text.length > 600) return c.json({ error: 'text must be 1-600 characters' }, 400)
  if (!isTtsConfigured()) return c.json({ error: 'TTS not configured' }, 503)
  const accent = c.req.query('accent') === 'us' ? 'us' : 'uk'
  try {
    const audio = await synthesize(text, accent)
    if (!audio) return c.json({ error: 'TTS not configured' }, 503)
    return c.body(new Uint8Array(audio), 200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=31536000, immutable' })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'TTS failed' }, 502)
  }
})

// A short-lived Azure Speech token for pronunciation assessment in the browser.
// 503 when Azure is not configured: the client then lets the user mark words by hand.
app.get('/speech/token', requireUser, async (c) => {
  if (!isSpeechConfigured()) return c.json({ error: 'Speech not configured' }, 503)
  try {
    const token = await speechToken()
    if (!token) return c.json({ error: 'Speech not configured' }, 503)
    return c.json(token)
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Speech token failed' }, 502)
  }
})

// One-time merge of a browser's old local error book into the account.
app.post('/review/import-local', async (c) => {
  const parsed = z
    .object({ words: z.array(importWordInput.extend({ originDict: z.string().max(200).nullish() })).max(5000) })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: 'Invalid words', issues: parsed.error.issues }, 400)
  }
  return c.json(
    await importWords(
      c.get('userId'),
      parsed.data.words.map((w) => ({ ...w, source: 'typing' as const })),
    ),
  )
})

// Words (lowercased) the user has practiced in any of the given dictionaries.
// ?mode=speak looks at words read aloud (speak records) instead of typed ones.
app.get('/words/practiced', async (c) => {
  const dicts = (c.req.query('dicts') ?? '').split(',').filter(Boolean).slice(0, 100)
  if (dicts.length === 0) return c.json({ words: [] })
  const rows =
    c.req.query('mode') === 'speak'
      ? await db
          .selectDistinct({ word: speakRecord.word })
          .from(speakRecord)
          .where(and(eq(speakRecord.userId, c.get('userId')), inArray(speakRecord.dict, dicts)))
      : await db
          .selectDistinct({ word: wordRecord.word })
          .from(wordRecord)
          .where(and(eq(wordRecord.userId, c.get('userId')), inArray(wordRecord.dict, dicts)))
  return c.json({ words: Array.from(new Set(rows.map((row) => row.word.toLowerCase()))) })
})

// ---- API key management (admins, from the user management page) ----

app.get('/api-keys', async (c) => {
  const keys = await db
    .select({ id: apiKey.id, name: apiKey.name, prefix: apiKey.prefix, createdAt: apiKey.createdAt, lastUsedAt: apiKey.lastUsedAt })
    .from(apiKey)
    .where(and(eq(apiKey.userId, c.get('userId')), isNull(apiKey.revokedAt)))
    .orderBy(desc(apiKey.createdAt))
  return c.json({ keys })
})

app.post('/api-keys', async (c) => {
  const parsed = z.object({ name: z.string().trim().min(1).max(100) }).safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: 'Name is required' }, 400)
  }
  const key = `qlk_${randomBytes(32).toString('base64url')}`
  const row = { id: randomUUID(), userId: c.get('userId'), name: parsed.data.name, prefix: key.slice(0, 10), keyHash: hashKey(key) }
  await db.insert(apiKey).values(row)
  // The full key is returned only this once.
  return c.json({ id: row.id, name: row.name, prefix: row.prefix, key }, 201)
})

app.delete('/api-keys/:id', async (c) => {
  await db
    .update(apiKey)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKey.id, c.req.param('id')), eq(apiKey.userId, c.get('userId'))))
  return c.json({ ok: true })
})

// ---- /api/v1: import API for scripts and agents (see docs/API.md) ----

app.get('/v1/users', async (c) => {
  const users = await db.select({ username: user.username, role: user.role }).from(user).orderBy(asc(user.createdAt))
  return c.json({ users })
})

app.get('/v1/review-words', async (c) => {
  const userId = await findUserIdByUsername(c.req.query('username') ?? '')
  if (!userId) return c.json({ error: 'Unknown username' }, 404)
  const type = z.enum(CARD_TYPES).optional().safeParse(c.req.query('type'))
  if (!type.success) return c.json({ error: 'Invalid type' }, 400)
  return c.json({ cards: await listCards(userId, type.data) })
})

const sentenceImportInput = z.object({
  username: z.string().min(1),
  // chapters are grouped by this date; defaults to today (APP_TIMEZONE, Australia/Perth)
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  items: z
    .array(
      z.object({
        sentence: z.string().trim().min(1).max(600),
        trans: transInput,
        note: z.string().max(1000).nullish(),
      }),
    )
    .min(1)
    .max(1000),
})

// FIB collocations: each sentence has exactly one [blank], e.g. "consistent [with] previous studies".
app.post('/v1/fib', async (c) => {
  const parsed = sentenceImportInput
    .superRefine((body, ctx) =>
      body.items.forEach((item, i) => {
        if (!parseFib(item.sentence)) {
          ctx.addIssue({ code: 'custom', path: ['items', i, 'sentence'], message: 'must contain exactly one [blank]' })
        }
      }),
    )
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', issues: parsed.error.issues }, 400)
  }
  const userId = await findUserIdByUsername(parsed.data.username)
  if (!userId) return c.json({ error: 'Unknown username' }, 404)
  return c.json(await importBankItems(userId, 'fib', parsed.data.items, parsed.data.date))
})

// WFD sentences, dictated as a whole.
app.post('/v1/wfd', async (c) => {
  const parsed = sentenceImportInput.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', issues: parsed.error.issues }, 400)
  }
  const userId = await findUserIdByUsername(parsed.data.username)
  if (!userId) return c.json({ error: 'Unknown username' }, 404)
  return c.json(await importBankItems(userId, 'wfd', parsed.data.items, parsed.data.date))
})

app.post('/v1/review-words', async (c) => {
  const parsed = z
    .object({ username: z.string().min(1), words: z.array(importWordInput).min(1).max(1000) })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', issues: parsed.error.issues }, 400)
  }
  const userId = await findUserIdByUsername(parsed.data.username)
  if (!userId) return c.json({ error: 'Unknown username' }, 404)
  return c.json(await importWords(userId, parsed.data.words))
})

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
    .select({
      currentDict: userPreference.currentDict,
      currentChapter: userPreference.currentChapter,
      speakDict: userPreference.speakDict,
      speakChapter: userPreference.speakChapter,
    })
    .from(userPreference)
    .where(eq(userPreference.userId, c.get('userId')))
  return c.json(row ?? { currentDict: null, currentChapter: null, speakDict: null, speakChapter: null })
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
  const { timeStamp, mode, trans, usphone, ukphone, cardId, itemId, ...record } = parsed.data
  const [row] = await db
    .insert(wordRecord)
    .values({ ...record, typedAt: timeStamp, userId: c.get('userId') })
    .returning({ id: wordRecord.id })
  // Only the first try counts: any mistake on the way to typing the word correctly marks it wrong.
  const correct = record.wrongCount === 0
  if (itemId !== undefined) {
    const item = await findBankItem(c.get('userId'), itemId)
    if (item) await recordBankAnswer(c.get('userId'), { ...item, type: item.type as BankType }, correct)
  } else {
    await recordAnswer(
      c.get('userId'),
      { word: record.word, trans, usphone, ukphone },
      { correct, kind: mode, originDict: record.dict, cardId },
    )
  }
  return c.json(row, 201)
})

// One attempt at reading a word aloud. Only the first attempt grades the speak card
// (or creates one on failure); later attempts in the same chapter are just logged.
app.post('/records/speak', async (c) => {
  const parsed = speakRecordInput.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: 'Invalid speak record', issues: parsed.error.issues }, 400)
  }
  const { timeStamp, mode, trans, usphone, ukphone, cardId, ...record } = parsed.data
  const [row] = await db
    .insert(speakRecord)
    .values({ ...record, spokenAt: timeStamp, userId: c.get('userId') })
    .returning({ id: speakRecord.id })
  if (record.firstTry) {
    await recordSpeakAnswer(
      c.get('userId'),
      { word: record.word, trans, usphone, ukphone },
      {
        passed: record.passed,
        kind: mode,
        originDict: record.dict,
        cardId,
        attempt: { score: record.score, phonemes: record.phonemes, locale: record.locale },
      },
    )
  }
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
