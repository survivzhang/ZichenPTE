import { postJSON } from './api'
import { db } from './db'
import { wordListFetcher } from './wordListFetcher'
import { idDictionaryMap } from '@/resources/dictionary'
import type { Word } from '@/typings'

/**
 * Before the account had a database, mistakes lived only in this browser's
 * IndexedDB. Upload them once so they join the account's review queue.
 */
// Unix seconds; login and server-side records were introduced on 2026-10-20.
const ACCOUNTS_LAUNCHED_AT = Date.UTC(2026, 9, 20) / 1000

let inFlight: Promise<void> | null = null

export function mergeLocalErrorBook(userId: string) {
  // The home page may mount twice in a row; run the upload only once at a time.
  inFlight ??= merge(userId).finally(() => {
    inFlight = null
  })
  return inFlight
}

async function merge(userId: string) {
  const key = `localErrorBookMerged:${userId}`
  try {
    if (localStorage.getItem(key)) return
  } catch {
    return
  }

  // Only records from before accounts existed: later ones were already sent to the server as they
  // were typed, and IndexedDB isn't per account, so they may belong to someone else on this browser.
  const records = (
    await db.wordRecords
      .where('wrongCount')
      .above(0)
      .toArray()
      .catch(() => [])
  ).filter((record) => record.timeStamp < ACCOUNTS_LAUNCHED_AT)

  if (records.length > 0) {
    // Local records only keep the word; look up meaning and phonetics in its dictionary.
    const words: { word: string; trans: string[]; usphone: string | null; ukphone: string | null; originDict: string }[] = []
    const dictIds = Array.from(new Set(records.map((record) => record.dict)))
    for (const dictId of dictIds) {
      const dict = idDictionaryMap[dictId]
      const list: Word[] = dict ? await wordListFetcher(dict.url).catch(() => []) : []
      const byName = new Map(list.map((word) => [word.name.toLowerCase(), word]))
      for (const record of records.filter((r) => r.dict === dictId)) {
        const found = byName.get(record.word.toLowerCase())
        words.push({
          word: record.word,
          trans: Array.isArray(found?.trans) ? found.trans.filter((t) => typeof t === 'string') : [],
          usphone: found?.usphone ?? null,
          ukphone: found?.ukphone ?? null,
          originDict: dictId,
        })
      }
    }
    const result = await postJSON('/review/import-local', { words })
    // Try again next time if the upload failed.
    if (!result) return
  }

  try {
    localStorage.setItem(key, new Date().toISOString())
  } catch {
    // ignore
  }
}
