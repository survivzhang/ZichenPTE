import { db } from './db/index.js'
import { chapterRecord, practiceItem } from './db/schema.js'
import { sentenceCard } from './srs.js'
import type { ImportSentence } from './srs.js'
import { and, asc, eq, gte } from 'drizzle-orm'

export type BankType = 'fib' | 'wfd'

// Items per chapter within one import date: WFD sentences are long, so fewer.
export const CHAPTER_SIZE: Record<BankType, number> = { fib: 10, wfd: 5 }

// Chapter records for bank chapters are filed under these pseudo-dictionaries.
export const BANK_DICT: Record<BankType, string> = { fib: 'pte-fib', wfd: 'pte-wfd' }

/** Today's date (YYYY-MM-DD) in the app's timezone; chapters are grouped by import date. */
export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: process.env.APP_TIMEZONE || 'Australia/Perth' }).format(new Date())
}

/** Add sentences to the user's bank. Sentences already in the bank are skipped. */
export async function importBankItems(userId: string, type: BankType, items: ImportSentence[], importDate = today()) {
  let created = 0
  let skipped = 0
  for (const item of items) {
    const card = sentenceCard(type, item.sentence)
    const [row] = await db
      .insert(practiceItem)
      .values({ userId, type, key: card.key, sentence: card.sentence, trans: item.trans ?? [], note: item.note ?? null, importDate })
      .onConflictDoNothing({ target: [practiceItem.userId, practiceItem.type, practiceItem.key] })
      .returning({ id: practiceItem.id })
    if (row) {
      created++
    } else {
      skipped++
    }
  }
  return { created, skipped }
}

/**
 * The bank split into chapters: by import date (oldest first), then
 * CHAPTER_SIZE items per chapter. A chapter's `index` is derived from its date
 * and part (2026-10-20 part 1 -> 2026102001), so importing more items, even for
 * an earlier date, never renumbers chapters that were already practiced.
 */
export async function bankChapters(userId: string, type: BankType) {
  const items = await db
    .select({
      id: practiceItem.id,
      sentence: practiceItem.sentence,
      trans: practiceItem.trans,
      note: practiceItem.note,
      importDate: practiceItem.importDate,
    })
    .from(practiceItem)
    .where(and(eq(practiceItem.userId, userId), eq(practiceItem.type, type)))
    .orderBy(asc(practiceItem.importDate), asc(practiceItem.id))

  const chapters: { index: number; date: string; part: number; items: typeof items }[] = []
  for (const item of items) {
    const last = chapters[chapters.length - 1]
    if (last && last.date === item.importDate && last.items.length < CHAPTER_SIZE[type]) {
      last.items.push(item)
    } else {
      const part = last && last.date === item.importDate ? last.part + 1 : 1
      chapters.push({ index: Number(item.importDate.replace(/-/g, '')) * 100 + part, date: item.importDate, part, items: [item] })
    }
  }

  const done = await db
    .selectDistinct({ chapter: chapterRecord.chapter })
    .from(chapterRecord)
    .where(and(eq(chapterRecord.userId, userId), eq(chapterRecord.dict, BANK_DICT[type]), gte(chapterRecord.chapter, 0)))
  const completed = new Set(done.map((row) => row.chapter))

  return chapters.map((chapter) => ({ ...chapter, completed: completed.has(chapter.index) }))
}

export async function findBankItem(userId: string, id: number) {
  const [row] = await db
    .select()
    .from(practiceItem)
    .where(and(eq(practiceItem.id, id), eq(practiceItem.userId, userId)))
  return row
}
