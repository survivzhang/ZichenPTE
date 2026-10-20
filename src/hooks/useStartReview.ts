import type { SessionType } from '@/store'
import { srsReviewAtom } from '@/store'
import type { BankChapter } from '@/utils/review'
import { bankChapterTitle, bankItemToWord, cardToWord, fetchAllCards, fetchDueCards } from '@/utils/review'
import { useSetAtom } from 'jotai'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { mutate } from 'swr'

/**
 * Open a session of review cards on the practice page.
 * - mode review: the cards due today (for `word`, the mandatory daily review)
 * - mode learn: every card of the type, practiced outside the schedule
 */
export function useStartSession() {
  const setSession = useSetAtom(srsReviewAtom)
  const navigate = useNavigate()
  return useCallback(
    async (type: SessionType, mode: 'review' | 'learn') => {
      let cards
      if (mode === 'review') {
        const due = await fetchDueCards(type)
        mutate(type === 'word' ? 'review-due' : `review-due-${type}`, due, { revalidate: false })
        cards = due?.cards
      } else {
        cards = (await fetchAllCards(type))?.cards
      }
      if (!cards || cards.length === 0) return
      setSession({ active: true, words: cards.map(cardToWord), type, mode })
      navigate('/practice')
    },
    [navigate, setSession],
  )
}

/** Open one chapter of the FIB / WFD question bank on the practice page. */
export function useStartBankChapter() {
  const setSession = useSetAtom(srsReviewAtom)
  const navigate = useNavigate()
  return useCallback(
    (type: 'fib' | 'wfd', chapter: BankChapter) => {
      setSession({
        active: true,
        words: chapter.items.map((item) => bankItemToWord(type, item)),
        type,
        mode: 'bank',
        chapter: chapter.index,
        title: bankChapterTitle(chapter),
      })
      navigate('/practice')
    },
    [navigate, setSession],
  )
}

/** Start today's (mandatory) word review. */
export default function useStartReview() {
  const startSession = useStartSession()
  return useCallback(() => startSession('word', 'review'), [startSession])
}
