import { srsReviewAtom } from '@/store'
import { cardToWord, fetchDueCards } from '@/utils/review'
import { useSetAtom } from 'jotai'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { mutate } from 'swr'

/** Load today's due review cards and open them on the practice page. */
export default function useStartReview() {
  const setSrsReview = useSetAtom(srsReviewAtom)
  const navigate = useNavigate()
  return useCallback(async () => {
    const due = await fetchDueCards()
    mutate('review-due', due, { revalidate: false })
    if (!due || due.count === 0) return
    setSrsReview({ active: true, words: due.cards.map(cardToWord) })
    navigate('/practice')
  }, [navigate, setSrsReview])
}
