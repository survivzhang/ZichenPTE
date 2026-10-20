import { getJSON } from '@/utils/api'
import useSWR from 'swr'

interface IDictStats {
  exercisedChapterCount: number
}

/** Finished chapters per dictionary, fetched once for all dictionary cards. */
export function useDictStats(dictID: string, isStartLoad: boolean): IDictStats | null {
  const { data } = useSWR(isStartLoad ? 'stats-dicts' : null, () => getJSON<{ dicts: Record<string, number> }>('/stats/dicts'))
  if (!data) return null
  return { exercisedChapterCount: data.dicts[dictID] ?? 0 }
}
