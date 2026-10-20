import { toFixedNumber } from '@/utils'
import { getJSON } from '@/utils/api'
import useSWR from 'swr'

interface IChapterStats {
  exerciseCount: number
  avgWrongWordCount: number
  avgWrongInputCount: number
}

type ChapterTotals = { chapter: number; exerciseCount: number; wrongWordTotal: number; wrongInputTotal: number }

/** Practice totals for one chapter; all chapters of a dictionary come from one request. */
export function useChapterStats(chapter: number, dictID: string, isStartLoad: boolean): IChapterStats | null {
  const { data } = useSWR(isStartLoad ? `stats-chapters-${dictID}` : null, () =>
    getJSON<{ chapters: ChapterTotals[] }>(`/stats/chapters?dict=${encodeURIComponent(dictID)}`),
  )
  if (!data) return null
  const totals = data.chapters.find((row) => row.chapter === chapter)
  const exerciseCount = totals?.exerciseCount ?? 0
  return {
    exerciseCount,
    avgWrongWordCount: exerciseCount > 0 ? toFixedNumber((totals?.wrongWordTotal ?? 0) / exerciseCount, 2) : 0,
    avgWrongInputCount: exerciseCount > 0 ? toFixedNumber((totals?.wrongInputTotal ?? 0) / exerciseCount, 2) : 0,
  }
}
