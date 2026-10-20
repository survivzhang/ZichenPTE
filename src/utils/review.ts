import { getJSON } from './api'
import type { Word } from '@/typings'
import useSWR from 'swr'

export type DueCard = {
  word: string
  trans: string[]
  usphone: string | null
  ukphone: string | null
  source: string
  due: string
}

/** The end of the user's local day: reviews due any time today count as today's. */
export function endOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
}

export const fetchDueCards = () =>
  getJSON<{ count: number; cards: DueCard[] }>(`/review/due?before=${encodeURIComponent(endOfToday().toISOString())}`)

/** Today's due reviews; `count` is undefined until loaded. */
export function useDueReviews() {
  const { data, mutate } = useSWR('review-due', fetchDueCards, { revalidateOnFocus: true })
  return { count: data?.count, cards: data?.cards ?? [], refresh: mutate }
}

export const cardToWord = (card: DueCard): Word => ({
  name: card.word,
  trans: card.trans,
  usphone: card.usphone ?? '',
  ukphone: card.ukphone ?? '',
})
