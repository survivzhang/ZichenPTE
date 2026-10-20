import { db } from './db/index.js'
import { reviewCard, reviewLog } from './db/schema.js'
import { and, asc, eq, inArray, lte } from 'drizzle-orm'
import type { Card, Grade } from 'ts-fsrs'
import { Rating, createEmptyCard, fsrs, generatorParameters } from 'ts-fsrs'

// No same-day learning steps: an item answered wrong comes back the next day,
// not ten minutes later, so a day's review can actually be finished.
const scheduler = fsrs(generatorParameters({ enable_short_term: false, enable_fuzz: true }))

export const CARD_TYPES = ['word', 'fib', 'wfd'] as const
export type CardType = (typeof CARD_TYPES)[number]
export type CardSource = 'typing' | 'listening' | 'speaking' | 'reading' | 'writing' | 'other'

export type WordInfo = {
  word: string
  trans?: string[]
  usphone?: string | null
  ukphone?: string | null
}

type CardRow = typeof reviewCard.$inferSelect

const normalizeWord = (word: string) => word.trim().toLowerCase()

/** WFD is marked like PTE: case and punctuation don't matter, only the words. */
export function normalizeSentence(sentence: string) {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** "The results are consistent [with] previous studies." -> answer and context. */
export function parseFib(sentence: string) {
  const match = sentence.match(/^([^[\]]*)\[([^[\]]+)\]([^[\]]*)$/)
  if (!match) return null
  const [, before, answer, after] = match
  return { before, answer: answer.trim(), after }
}

function toFsrsCard(row: CardRow): Card {
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsedDays,
    scheduled_days: row.scheduledDays,
    learning_steps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.lastReview ?? undefined,
  }
}

function fromFsrsCard(card: Card) {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review ?? null,
  }
}

async function findCard(userId: string, type: CardType, key: string) {
  const [row] = await db
    .select()
    .from(reviewCard)
    .where(and(eq(reviewCard.userId, userId), eq(reviewCard.type, type), eq(reviewCard.word, key)))
  return row
}

async function grade(userId: string, row: CardRow, correct: boolean, kind: 'learn' | 'review') {
  const rating: Grade = correct ? Rating.Good : Rating.Again
  const { card } = scheduler.next(toFsrsCard(row), new Date(), rating)
  await db.update(reviewCard).set(fromFsrsCard(card)).where(eq(reviewCard.id, row.id))
  await db.insert(reviewLog).values({ userId, cardId: row.id, kind, correct, rating, nextDue: card.due })
}

/**
 * Record one answer.
 *
 * - With `cardId` (a review or a FIB/WFD session): grade that card. In `learn`
 *   mode (practicing outside the schedule) only a mistake changes it.
 * - Without (a word in a normal chapter): a first-try mistake creates a word
 *   card or lapses the existing one; a correct answer changes nothing, since
 *   only mistakes are reviewed.
 */
export async function recordAnswer(
  userId: string,
  info: WordInfo,
  { correct, kind, originDict, cardId }: { correct: boolean; kind: 'learn' | 'review'; originDict?: string; cardId?: number },
) {
  if (cardId !== undefined) {
    const [row] = await db
      .select()
      .from(reviewCard)
      .where(and(eq(reviewCard.id, cardId), eq(reviewCard.userId, userId)))
    if (!row || (kind === 'learn' && correct)) return
    await grade(userId, row, correct, kind)
    return
  }

  let row = await findCard(userId, 'word', normalizeWord(info.word))
  if (!row) {
    if (correct) return
    ;[row] = await db
      .insert(reviewCard)
      .values({
        userId,
        type: 'word',
        word: normalizeWord(info.word),
        displayWord: info.word.trim(),
        trans: info.trans ?? [],
        usphone: info.usphone ?? null,
        ukphone: info.ukphone ?? null,
        source: 'typing',
        originDict: originDict ?? null,
        ...fromFsrsCard(createEmptyCard(new Date())),
      })
      // Two requests for the same word can race; the loser uses the winner's card.
      .onConflictDoNothing({ target: [reviewCard.userId, reviewCard.type, reviewCard.word] })
      .returning()
    row ??= await findCard(userId, 'word', normalizeWord(info.word))
    if (!row) return
  } else if (kind === 'learn' && correct) {
    return
  }
  await grade(userId, row, correct, kind)
}

type NewCard = {
  type: CardType
  key: string
  displayWord: string
  sentence?: string | null
  trans?: string[]
  usphone?: string | null
  ukphone?: string | null
  source: CardSource
  note?: string | null
  originDict?: string | null
}

/**
 * Add mistakes from outside the typing practice (the API, or an old local
 * error book). New items become cards due now. Items that already have a card
 * are brought forward to now, unless `onlyNew` is set (merging old data must
 * not reshuffle existing schedules).
 */
async function importCards(userId: string, items: NewCard[], { onlyNew = false } = {}) {
  const now = new Date()
  let created = 0
  let updated = 0
  const seen = new Set<string>()
  for (const item of items) {
    const seenKey = `${item.type}:${item.key}`
    if (!item.key || seen.has(seenKey)) continue
    seen.add(seenKey)
    const existing = await findCard(userId, item.type, item.key)
    if (existing && onlyNew) continue
    if (existing) {
      const due = existing.due < now ? existing.due : now
      await db
        .update(reviewCard)
        .set({
          due,
          ...(item.trans?.length && !existing.trans.length ? { trans: item.trans } : {}),
          ...(item.note ? { note: item.note } : {}),
        })
        .where(eq(reviewCard.id, existing.id))
      await db.insert(reviewLog).values({ userId, cardId: existing.id, kind: 'import', correct: false, rating: 0, nextDue: due })
      updated++
    } else {
      const [row] = await db
        .insert(reviewCard)
        .values({
          userId,
          type: item.type,
          word: item.key,
          displayWord: item.displayWord,
          sentence: item.sentence ?? null,
          trans: item.trans ?? [],
          usphone: item.usphone ?? null,
          ukphone: item.ukphone ?? null,
          source: item.source,
          note: item.note ?? null,
          originDict: item.originDict ?? null,
          ...fromFsrsCard(createEmptyCard(now)),
        })
        .onConflictDoNothing({ target: [reviewCard.userId, reviewCard.type, reviewCard.word] })
        .returning({ id: reviewCard.id })
      // Created concurrently by another request: nothing more to do.
      if (!row) continue
      await db.insert(reviewLog).values({ userId, cardId: row.id, kind: 'import', correct: false, rating: 0, nextDue: now })
      created++
    }
  }
  return { created, updated }
}

export type ImportWord = WordInfo & { source?: CardSource; note?: string | null; originDict?: string | null }

export function importWords(userId: string, words: ImportWord[], options: { onlyNew?: boolean } = {}) {
  return importCards(
    userId,
    words.map((w) => ({
      type: 'word' as const,
      key: normalizeWord(w.word),
      displayWord: w.word.trim(),
      trans: w.trans,
      usphone: w.usphone,
      ukphone: w.ukphone,
      source: w.source ?? 'other',
      note: w.note,
      originDict: w.originDict,
    })),
    options,
  )
}

export type ImportSentence = { sentence: string; trans?: string[]; note?: string | null }

/** FIB sentences must contain exactly one [blank]; callers validate with parseFib first. */
export function importSentences(userId: string, type: 'fib' | 'wfd', items: ImportSentence[]) {
  return importCards(
    userId,
    items.map((item) => {
      const sentence = item.sentence.trim().replace(/\s+/g, ' ')
      return {
        type,
        // fib keeps the brackets in the key, so the same sentence with a different blank is a different card
        key: type === 'fib' ? sentence.toLowerCase() : normalizeSentence(sentence),
        displayWord: type === 'fib' ? parseFib(sentence)?.answer ?? sentence : sentence,
        sentence,
        trans: item.trans,
        source: 'other' as const,
        note: item.note,
      }
    }),
  )
}

const cardFields = {
  id: reviewCard.id,
  type: reviewCard.type,
  word: reviewCard.displayWord,
  sentence: reviewCard.sentence,
  trans: reviewCard.trans,
  usphone: reviewCard.usphone,
  ukphone: reviewCard.ukphone,
  source: reviewCard.source,
  note: reviewCard.note,
  originDict: reviewCard.originDict,
  due: reviewCard.due,
  reps: reviewCard.reps,
  lapses: reviewCard.lapses,
}

/** Cards of a type due before `before`, oldest first. */
export function dueCards(userId: string, type: CardType, before: Date) {
  return db
    .select(cardFields)
    .from(reviewCard)
    .where(and(eq(reviewCard.userId, userId), eq(reviewCard.type, type), lte(reviewCard.due, before)))
    .orderBy(asc(reviewCard.due))
}

/** Cards (optionally of one type) with their full answer history, oldest answer first. */
export async function listCards(userId: string, type?: CardType) {
  const cards = await db
    .select(cardFields)
    .from(reviewCard)
    .where(type ? and(eq(reviewCard.userId, userId), eq(reviewCard.type, type)) : eq(reviewCard.userId, userId))
    .orderBy(asc(reviewCard.due))
  if (cards.length === 0) return []
  const logs = await db
    .select({ cardId: reviewLog.cardId, kind: reviewLog.kind, correct: reviewLog.correct, reviewedAt: reviewLog.reviewedAt })
    .from(reviewLog)
    .where(
      inArray(
        reviewLog.cardId,
        cards.map((card) => card.id),
      ),
    )
    .orderBy(asc(reviewLog.reviewedAt))
  const byCard = new Map<number, typeof logs>()
  for (const log of logs) {
    byCard.set(log.cardId, [...(byCard.get(log.cardId) ?? []), log])
  }
  return cards.map((card) => ({
    ...card,
    history: (byCard.get(card.id) ?? []).map(({ kind, correct, reviewedAt }) => ({ kind, correct, at: reviewedAt })),
  }))
}
