import { db } from './db/index.js'
import { reviewCard, reviewLog } from './db/schema.js'
import { and, eq, inArray } from 'drizzle-orm'
import type { Card, Grade } from 'ts-fsrs'
import { Rating, createEmptyCard, fsrs, generatorParameters } from 'ts-fsrs'

// No same-day learning steps: a word answered wrong comes back the next day,
// not ten minutes later, so a day's review can actually be finished.
const scheduler = fsrs(generatorParameters({ enable_short_term: false, enable_fuzz: true }))

export type WordInfo = {
  word: string
  trans?: string[]
  usphone?: string | null
  ukphone?: string | null
}

export type CardSource = 'typing' | 'listening' | 'speaking' | 'reading' | 'writing' | 'other'

type CardRow = typeof reviewCard.$inferSelect

const normalize = (word: string) => word.trim().toLowerCase()

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

async function findCard(userId: string, word: string) {
  const [row] = await db
    .select()
    .from(reviewCard)
    .where(and(eq(reviewCard.userId, userId), eq(reviewCard.word, normalize(word))))
  return row
}

/**
 * Record one answer for a word.
 *
 * - learn: the word came up in a normal chapter. A first-try mistake creates a
 *   card (or lapses an existing one); a correct answer changes nothing, since
 *   only mistakes are reviewed.
 * - review: the word came up in the daily review; first try correct = Good,
 *   otherwise Again.
 */
export async function recordAnswer(
  userId: string,
  info: WordInfo,
  { correct, kind, originDict }: { correct: boolean; kind: 'learn' | 'review'; originDict?: string },
) {
  const now = new Date()
  let row = await findCard(userId, info.word)
  if (!row) {
    if (correct) return
    ;[row] = await db
      .insert(reviewCard)
      .values({
        userId,
        word: normalize(info.word),
        displayWord: info.word.trim(),
        trans: info.trans ?? [],
        usphone: info.usphone ?? null,
        ukphone: info.ukphone ?? null,
        source: 'typing',
        originDict: originDict ?? null,
        ...fromFsrsCard(createEmptyCard(now)),
      })
      // Two requests for the same word can race; the loser uses the winner's card.
      .onConflictDoNothing({ target: [reviewCard.userId, reviewCard.word] })
      .returning()
    row ??= await findCard(userId, info.word)
    if (!row) return
  } else if (kind === 'learn' && correct) {
    return
  }

  const rating: Grade = correct ? Rating.Good : Rating.Again
  const { card } = scheduler.next(toFsrsCard(row), now, rating)
  await db.update(reviewCard).set(fromFsrsCard(card)).where(eq(reviewCard.id, row.id))
  await db.insert(reviewLog).values({ userId, cardId: row.id, kind, correct, rating, nextDue: card.due })
}

export type ImportWord = WordInfo & { source?: CardSource; note?: string | null; originDict?: string | null }

/**
 * Add mistakes from outside the typing practice (the API, or an old local
 * error book). New words become cards due now. Words that already have a card
 * are brought forward to now so they show up in today's review, unless
 * `onlyNew` is set (merging old data must not reshuffle existing schedules).
 */
export async function importWords(userId: string, words: ImportWord[], { onlyNew = false } = {}) {
  const now = new Date()
  let created = 0
  let updated = 0
  const seen = new Set<string>()
  for (const item of words) {
    const word = normalize(item.word)
    if (!word || seen.has(word)) continue
    seen.add(word)
    const existing = await findCard(userId, word)
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
          word,
          displayWord: item.word.trim(),
          trans: item.trans ?? [],
          usphone: item.usphone ?? null,
          ukphone: item.ukphone ?? null,
          source: item.source ?? 'other',
          note: item.note ?? null,
          originDict: item.originDict ?? null,
          ...fromFsrsCard(createEmptyCard(now)),
        })
        .onConflictDoNothing({ target: [reviewCard.userId, reviewCard.word] })
        .returning({ id: reviewCard.id })
      // Created concurrently by another request: nothing more to do.
      if (!row) continue
      await db.insert(reviewLog).values({ userId, cardId: row.id, kind: 'import', correct: false, rating: 0, nextDue: now })
      created++
    }
  }
  return { created, updated }
}

/** Cards with their full answer history, oldest answer first. */
export async function listCards(userId: string) {
  const cards = await db.select().from(reviewCard).where(eq(reviewCard.userId, userId)).orderBy(reviewCard.due)
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
    .orderBy(reviewLog.reviewedAt)
  const byCard = new Map<number, typeof logs>()
  for (const log of logs) {
    byCard.set(log.cardId, [...(byCard.get(log.cardId) ?? []), log])
  }
  return cards.map((card) => ({
    word: card.displayWord,
    trans: card.trans,
    usphone: card.usphone,
    ukphone: card.ukphone,
    source: card.source,
    note: card.note,
    originDict: card.originDict,
    due: card.due,
    reps: card.reps,
    lapses: card.lapses,
    history: (byCard.get(card.id) ?? []).map(({ kind, correct, reviewedAt }) => ({ kind, correct, at: reviewedAt })),
  }))
}
