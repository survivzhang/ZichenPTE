import { getJSON } from './api'
import type { SessionType } from '@/store'
import type { Word } from '@/typings'
import useSWR from 'swr'

export type ReviewCardData = {
  id: number
  type: SessionType
  word: string
  sentence: string | null
  trans: string[]
  usphone: string | null
  ukphone: string | null
  source: string
  note: string | null
  due: string
}

/** The end of the user's local day: reviews due any time today count as today's. */
export function endOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
}

export const fetchDueCards = (type: SessionType = 'word') =>
  getJSON<{ count: number; cards: ReviewCardData[] }>(`/review/due?type=${type}&before=${encodeURIComponent(endOfToday().toISOString())}`)

export const fetchAllCards = (type: SessionType) => getJSON<{ cards: ReviewCardData[] }>(`/review/cards?type=${type}`)

/** Today's due cards; for `word` this is the mandatory daily review. `count` is undefined until loaded. */
export function useDueReviews(type: SessionType = 'word') {
  const { data, mutate } = useSWR(type === 'word' ? 'review-due' : `review-due-${type}`, () => fetchDueCards(type), {
    revalidateOnFocus: true,
  })
  return { count: data?.count, cards: data?.cards ?? [], refresh: mutate }
}

/** WFD is marked like PTE: case and punctuation don't matter, only the words. Mirrors the server. */
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

/** Turn a review card into an item for the typing page. */
export function cardToWord(card: ReviewCardData): Word {
  const base = { trans: card.trans, usphone: card.usphone ?? '', ukphone: card.ukphone ?? '', cardId: card.id }
  if (card.type === 'fib' && card.sentence) {
    const fib = parseFib(card.sentence)
    if (fib) {
      return {
        ...base,
        name: fib.answer,
        kind: 'fib',
        context: { before: fib.before, after: fib.after },
        speakText: `${fib.before}${fib.answer}${fib.after}`,
      }
    }
  }
  if (card.type === 'wfd') {
    const sentence = card.sentence ?? card.word
    return { ...base, name: normalizeSentence(sentence), kind: 'wfd', speakText: sentence }
  }
  return { ...base, name: card.word }
}

/** Name of a review session, for the practice page. */
export function sessionLabel(type?: SessionType, mode?: 'review' | 'learn') {
  if (type === 'fib') return 'FIB 固定搭配'
  if (type === 'wfd') return 'WFD 拼写'
  return mode === 'learn' ? '错词练习' : '今日复习'
}
