import PracticeMistakes from './PracticeMistakes'
import AppNav from '@/components/AppNav'
import Layout from '@/components/Layout'
import useStartReview from '@/hooks/useStartReview'
import { CategoryPath, DictGrid } from '@/pages/Gallery-N/CategoryAccordion'
import { idDictionaryMap } from '@/resources/dictionary'
import { PTE_CATEGORY, PTE_TAG, pteDictionaries } from '@/resources/pte'
import { currentChapterAtom, currentDictIdAtom, reviewModeInfoAtom, srsReviewAtom } from '@/store'
import { getJSON } from '@/utils/api'
import { authClient } from '@/utils/auth-client'
import { db } from '@/utils/db'
import { mergeLocalErrorBook } from '@/utils/mergeLocalErrorBook'
import { useDueReviews } from '@/utils/review'
import { useAtom, useSetAtom } from 'jotai'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import IconArrowRight from '~icons/tabler/arrow-right'
import IconLock from '~icons/tabler/lock'

const MODULES = [
  { id: 'vocabulary', label: '词汇' },
  { id: 'mistakes', label: '练习中错题' },
] as const

type ModuleId = (typeof MODULES)[number]['id']

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
  const setSrsReview = useSetAtom(srsReviewAtom)
  const { count: dueCount, refresh: refreshDue } = useDueReviews()
  const startReview = useStartReview()
  const [module, setModule] = useState<ModuleId>('vocabulary')
  const userId = session?.user.id

  // Fold this browser's pre-account error book into the review queue (once per account).
  useEffect(() => {
    if (userId) mergeLocalErrorBook(userId).then(() => refreshDue())
  }, [userId, refreshDue])
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
    setSrsReview({ active: false, words: [] })
    navigate('/practice')
  }

  const displayName = (session?.user as { displayUsername?: string } | undefined)?.displayUsername || session?.user.name
  const isLocked = (dueCount ?? 0) > 0

  return (
    <Layout>
      <AppNav />
      <div className="flex w-full flex-1 flex-col items-center overflow-y-auto px-10 pb-10">
        <div className="w-full max-w-6xl">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">你好，{displayName}</h1>
              <p className="mt-1 text-gray-500 dark:text-gray-400">PTE 备考 · 先复习，再学新词。</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="rounded-2xl bg-white p-7 shadow-sm dark:bg-gray-800">
              <p className="text-sm text-gray-400 dark:text-gray-500">今日复习</p>
              {dueCount === undefined ? (
                <p className="mt-3 text-gray-400">正在读取复习计划…</p>
              ) : dueCount > 0 ? (
                <>
                  <h2 className="mt-1 text-2xl font-semibold text-red-500">{dueCount} 个错词待复习</h2>
                  <p className="mt-2 text-gray-500 dark:text-gray-400">复习完成后才能学习新内容。复习算法：FSRS。</p>
                  <button
                    type="button"
                    autoFocus
                    onClick={startReview}
                    className="mt-5 inline-flex items-center rounded-xl bg-indigo-500 px-6 py-3 text-lg font-medium text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-600 dark:shadow-none"
                  >
                    开始复习
                    <IconArrowRight className="ml-2 h-5 w-5" />
                  </button>
                </>
              ) : (
                <>
                  <h2 className="mt-1 text-2xl font-semibold text-green-600">今天的复习已完成 ✓</h2>
                  <p className="mt-2 text-gray-500 dark:text-gray-400">打错的词会按 FSRS 计划在之后的日子里再出现。</p>
                </>
              )}
            </section>

            <section className={`rounded-2xl bg-white p-7 shadow-sm dark:bg-gray-800 ${isLocked ? 'opacity-60' : ''}`}>
              {dict && (
                <>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    继续学习 · {dict.category} / {dict.tags.join(' · ')}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-indigo-500">{dict.name}</h2>
                  {completed && (
                    <div className="mt-3">
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
              <div className="mt-5">
                {recommendation?.kind === 'dictDone' ? (
                  <p className="text-gray-700 dark:text-gray-200">这本词典已经全部练完了 🎉 从下面选一本继续吧。</p>
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
                      disabled={isLocked}
                      onClick={() => startPractice(recommendation.chapter)}
                      className="mt-4 inline-flex items-center rounded-xl bg-indigo-500 px-6 py-3 text-lg font-medium text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-600"
                    >
                      {isLocked && <IconLock className="mr-2 h-5 w-5" />}
                      {recommendation.kind === 'start' ? '开始练习' : '继续练习'} · 第 {recommendation.chapter + 1} 章
                      {!isLocked && <IconArrowRight className="ml-2 h-5 w-5" />}
                    </button>
                    {isLocked && <p className="mt-2 text-sm text-gray-400">先完成左边的今日复习</p>}
                  </>
                ) : (
                  <p className="text-gray-400">正在读取练习进度…</p>
                )}
              </div>
            </section>
          </div>

          <div className="mt-10 flex flex-wrap gap-2" role="tablist" aria-label="PTE 模块">
            {MODULES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={id === module}
                onClick={() => setModule(id)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                  id === module
                    ? 'bg-indigo-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-indigo-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {module === 'mistakes' ? (
            <PracticeMistakes />
          ) : (
            <section className="mt-6">
              <div className="mb-6">
                <CategoryPath category={PTE_CATEGORY} tag={`${PTE_TAG} 词汇`} />
              </div>
              <DictGrid dicts={pteDictionaries} />
            </section>
          )}
        </div>
      </div>
    </Layout>
  )
}
