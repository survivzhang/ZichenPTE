import Header from '@/components/Header'
import Layout from '@/components/Layout'
import { idDictionaryMap } from '@/resources/dictionary'
import { currentChapterAtom, currentDictIdAtom, reviewModeInfoAtom } from '@/store'
import { getJSON } from '@/utils/api'
import { authClient } from '@/utils/auth-client'
import { db } from '@/utils/db'
import { useAtom, useSetAtom } from 'jotai'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import IconArrowRight from '~icons/tabler/arrow-right'
import IconBook from '~icons/tabler/book-2'
import IconChartPie from '~icons/tabler/chart-pie'
import IconNotebook from '~icons/tabler/notebook'

type Recommendation =
  | { kind: 'start'; chapter: number }
  | { kind: 'continue'; chapter: number }
  | { kind: 'next'; chapter: number; finished: number }
  | { kind: 'dictDone' }

/** Chapters of `dictId` finished at least once, from the account and from this browser's local history. */
function useCompletedChapters(dictId: string) {
  const [completed, setCompleted] = useState<Set<number> | null>(null)

  useEffect(() => {
    let cancelled = false
    setCompleted(null)
    Promise.all([
      getJSON<{ completedChapters: number[] }>(`/progress?dict=${encodeURIComponent(dictId)}`),
      db.chapterRecords
        .where('dict')
        .equals(dictId)
        .toArray()
        .catch(() => []),
    ]).then(([server, local]) => {
      if (cancelled) return
      const chapters = [...(server?.completedChapters ?? []), ...local.map((record) => record.chapter ?? -1)]
      setCompleted(new Set(chapters.filter((chapter) => chapter >= 0)))
    })
    return () => {
      cancelled = true
    }
  }, [dictId])

  return completed
}

export default function HomePage() {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const [currentDictId] = useAtom(currentDictIdAtom)
  const [currentChapter, setCurrentChapter] = useAtom(currentChapterAtom)
  const setReviewModeInfo = useSetAtom(reviewModeInfoAtom)
  const dict = idDictionaryMap[currentDictId]
  const completed = useCompletedChapters(currentDictId)

  const recommendation = useMemo<Recommendation | null>(() => {
    if (!dict || !completed) return null
    // A negative chapter means the last session was a review; resume normal chapters.
    const lastChapter = Math.max(currentChapter, 0)
    if (!completed.has(lastChapter)) {
      return completed.size === 0 && lastChapter === 0 ? { kind: 'start', chapter: 0 } : { kind: 'continue', chapter: lastChapter }
    }
    if (lastChapter + 1 < dict.chapterCount) {
      return { kind: 'next', chapter: lastChapter + 1, finished: lastChapter }
    }
    return { kind: 'dictDone' }
  }, [completed, currentChapter, dict])

  const startPractice = (chapter: number) => {
    setCurrentChapter(chapter)
    setReviewModeInfo((old) => ({ ...old, isReviewMode: false }))
    navigate('/practice')
  }

  const displayName = (session?.user as { displayUsername?: string } | undefined)?.displayUsername || session?.user.name

  return (
    <Layout>
      <Header />
      <div className="flex w-full flex-1 flex-col items-center overflow-y-auto px-6 pt-6">
        <div className="w-full max-w-2xl">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">你好，{displayName}</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">准备好就开始今天的练习吧。</p>

          <div className="mt-8 rounded-2xl bg-white p-8 shadow-sm dark:bg-gray-800">
            {dict && (
              <>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {dict.category} / {dict.tags.join(' · ')}
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-indigo-500">{dict.name}</h2>
                {completed && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-sm text-gray-500 dark:text-gray-400">
                      <span>全书进度</span>
                      <span>
                        已完成 {completed.size} / {dict.chapterCount} 章
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-indigo-50 dark:bg-gray-700">
                      <div
                        className="h-full rounded-full bg-indigo-400 transition-all"
                        style={{ width: `${Math.min(100, (completed.size / dict.chapterCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="mt-8 min-h-[5.5rem]">
              {recommendation?.kind === 'dictDone' ? (
                <>
                  <p className="text-gray-700 dark:text-gray-200">这本词典已经全部练完了 🎉 换一本继续吧。</p>
                  <button
                    type="button"
                    onClick={() => navigate('/gallery')}
                    className="mt-4 inline-flex items-center rounded-xl bg-indigo-500 px-6 py-3 text-lg font-medium text-white transition hover:bg-indigo-600"
                  >
                    选择其他词典
                    <IconArrowRight className="ml-2 h-5 w-5" />
                  </button>
                </>
              ) : recommendation ? (
                <>
                  <p className="text-gray-700 dark:text-gray-200">
                    {recommendation.kind === 'start' && '从第 1 章开始吧。'}
                    {recommendation.kind === 'continue' && `上次练到第 ${recommendation.chapter + 1} 章，接着练。`}
                    {recommendation.kind === 'next' &&
                      `第 ${recommendation.finished + 1} 章已完成，推荐继续第 ${recommendation.chapter + 1} 章。`}
                  </p>
                  <button
                    type="button"
                    autoFocus
                    onClick={() => startPractice(recommendation.chapter)}
                    className="mt-4 inline-flex items-center rounded-xl bg-indigo-500 px-6 py-3 text-lg font-medium text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-600 dark:shadow-none"
                  >
                    {recommendation.kind === 'start' ? '开始练习' : '继续练习'} · 第 {recommendation.chapter + 1} 章
                    <IconArrowRight className="ml-2 h-5 w-5" />
                  </button>
                </>
              ) : (
                <p className="text-gray-400">正在读取练习进度…</p>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { to: '/gallery', label: '选择其他词典', Icon: IconBook },
              { to: '/error-book', label: '错题本', Icon: IconNotebook },
              { to: '/analysis', label: '数据统计', Icon: IconChartPie },
            ].map(({ to, label, Icon }) => (
              <button
                key={to}
                type="button"
                onClick={() => navigate(to)}
                className="flex items-center justify-center rounded-xl bg-white px-4 py-3 text-gray-600 shadow-sm transition hover:bg-indigo-50 hover:text-indigo-500 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Icon className="mr-2 h-5 w-5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
