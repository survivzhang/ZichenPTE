import AppNav from '@/components/AppNav'
import Layout from '@/components/Layout'
import useStartReview from '@/hooks/useStartReview'
import { getJSON } from '@/utils/api'
import { endOfToday, useDueReviews } from '@/utils/review'
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import IconArrowRight from '~icons/tabler/arrow-right'

type HistoryEntry = { kind: 'learn' | 'review' | 'import'; correct: boolean; at: string }

type ReviewCard = {
  word: string
  trans: string[]
  usphone: string | null
  ukphone: string | null
  source: string
  note: string | null
  originDict: string | null
  due: string
  reps: number
  lapses: number
  history: HistoryEntry[]
}

const SOURCE_LABELS: Record<string, string> = {
  typing: '打字',
  listening: '听力',
  speaking: '口语',
  reading: '阅读',
  writing: '写作',
  other: '其他',
}

const FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'due', label: '今日待复习' },
  ...Object.entries(SOURCE_LABELS).map(([id, label]) => ({ id, label })),
]

/** "今天" / "明天" / "3 天后" / a date, by local calendar day. */
function formatDue(due: string) {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(new Date(due)) - startOfDay(new Date())) / 86400000)
  if (days <= 0) return '今天'
  if (days === 1) return '明天'
  if (days < 30) return `${days} 天后`
  return new Date(due).toLocaleDateString()
}

function HistoryChips({ history }: { history: HistoryEntry[] }) {
  // Imports are not attempts, so they don't take a pass number.
  let pass = 0
  return (
    <div className="flex flex-wrap gap-1.5">
      {history.map((entry, i) => {
        if (entry.kind === 'import') {
          return (
            <span key={i} className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-300">
              导入
            </span>
          )
        }
        pass++
        return (
          <span
            key={i}
            title={new Date(entry.at).toLocaleString()}
            className={`rounded-md px-2 py-0.5 text-xs font-medium ${
              entry.correct
                ? 'bg-green-50 text-green-600 dark:bg-green-900/40 dark:text-green-300'
                : 'bg-red-50 text-red-500 dark:bg-red-900/40 dark:text-red-300'
            }`}
          >
            第{pass}遍 {entry.correct ? '✓' : '✗'}
          </span>
        )
      })}
    </div>
  )
}

export function ErrorBook() {
  const { data, isLoading } = useSWR('review-cards', () => getJSON<{ cards: ReviewCard[] }>('/review/cards'))
  const { count: dueCount } = useDueReviews()
  const startReview = useStartReview()
  const [filter, setFilter] = useState('all')

  const cards = useMemo(() => data?.cards ?? [], [data])
  const visibleCards = useMemo(() => {
    const todayEnd = endOfToday().getTime()
    if (filter === 'all') return cards
    if (filter === 'due') return cards.filter((card) => new Date(card.due).getTime() <= todayEnd)
    return cards.filter((card) => card.source === filter)
  }, [cards, filter])

  return (
    <Layout>
      <AppNav />
      <div className="flex w-full flex-1 flex-col items-center overflow-y-auto px-10 pb-10">
        <div className="w-full max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">错题本</h1>
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                共 {cards.length} 词 · 今日待复习 {dueCount ?? '…'} 词 · 第一遍就打对的词不会进入这里
              </p>
            </div>
            {!!dueCount && (
              <button
                type="button"
                onClick={startReview}
                className="inline-flex items-center rounded-xl bg-indigo-500 px-5 py-2.5 font-medium text-white transition hover:bg-indigo-600"
              >
                开始今日复习 · {dueCount} 词
                <IconArrowRight className="ml-2 h-5 w-5" />
              </button>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`rounded-full px-4 py-1.5 text-sm transition ${
                  filter === id
                    ? 'bg-indigo-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-indigo-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-gray-800">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">单词</th>
                  <th className="px-4 py-3 font-medium">释义</th>
                  <th className="px-4 py-3 font-medium">来源</th>
                  <th className="px-4 py-3 font-medium">学习记录</th>
                  <th className="px-4 py-3 font-medium">下次复习</th>
                </tr>
              </thead>
              <tbody>
                {visibleCards.map((card) => (
                  <tr key={card.word} className="border-t border-gray-100 align-top dark:border-gray-700">
                    <td className="px-4 py-3">
                      <div className="font-mono text-lg font-medium text-gray-800 dark:text-gray-100">{card.word}</div>
                      {(card.usphone || card.ukphone) && <div className="text-xs text-gray-400">/{card.usphone || card.ukphone}/</div>}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {card.trans.join('；') || '—'}
                      {card.note && <div className="mt-1 text-xs text-gray-400">备注：{card.note}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{SOURCE_LABELS[card.source] ?? card.source}</td>
                    <td className="px-4 py-3">
                      <HistoryChips history={card.history} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDue(card.due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {isLoading && <p className="px-4 py-6 text-center text-gray-400">加载中…</p>}
            {!isLoading && visibleCards.length === 0 && <p className="px-4 py-6 text-center text-gray-400">这里还没有错词</p>}
          </div>
        </div>
      </div>
    </Layout>
  )
}
