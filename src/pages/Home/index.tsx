import BankCards from './BankCards'
import PracticeMistakes from './PracticeMistakes'
import AppNav from '@/components/AppNav'
import Layout from '@/components/Layout'
import { useStartSession } from '@/hooks/useStartReview'
import { CategoryPath, DictGrid } from '@/pages/Gallery-N/CategoryAccordion'
import { idDictionaryMap } from '@/resources/dictionary'
import { PTE_CATEGORY, PTE_TAG, pteDictionaries } from '@/resources/pte'
import {
  currentChapterAtom,
  currentDictIdAtom,
  practiceModeAtom,
  speakChapterAtom,
  speakDictIdAtom,
  speakDictKey,
  srsReviewAtom,
} from '@/store'
import type { PracticeMode } from '@/store'
import { chapterLabel } from '@/utils'
import { getJSON } from '@/utils/api'
import { authClient } from '@/utils/auth-client'
import { useDueReviews } from '@/utils/review'
import { useAtom, useSetAtom } from 'jotai'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useSWR from 'swr'
import IconArrowRight from '~icons/tabler/arrow-right'
import IconKeyboard from '~icons/tabler/keyboard'
import IconLock from '~icons/tabler/lock'
import IconMicrophone from '~icons/tabler/microphone'

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

/** Chapters of `dictKey` finished at least once (null while loading). */
function useCompletedChapters(dictKey: string) {
  const { data } = useSWR(`progress-${dictKey}`, () =>
    getJSON<{ completedChapters: number[] }>(`/progress?dict=${encodeURIComponent(dictKey)}`),
  )
  return useMemo(() => (data ? new Set(data.completedChapters.filter((chapter) => chapter >= 0)) : null), [data])
}

const TRACKS = {
  spell: {
    label: '拼写',
    icon: IconKeyboard,
    hint: '看词打字，拼错进错词本',
    reviewTitle: '今日复习',
    unit: '个错词',
    reviewHint: '复习完成后才能学习新内容。复习算法：FSRS。',
    doneHint: '打错的词会按 FSRS 计划在之后的日子里再出现。',
    continueLabel: '继续学习',
    actionLabel: '练习',
  },
  speak: {
    label: '跟读',
    icon: IconMicrophone,
    hint: '看词朗读，Azure 打分，读错进错音库',
    reviewTitle: '错音复习',
    unit: '个读错的词',
    reviewHint: '复习完成后才能跟读新章节。复习算法：FSRS。',
    doneHint: '读错的词会按 FSRS 计划在之后的日子里再出现。',
    continueLabel: '继续跟读',
    actionLabel: '跟读',
  },
} as const

/** One practice track: today's review on the left, where to continue on the right. */
function TrackPanel({ mode }: { mode: PracticeMode }) {
  const navigate = useNavigate()
  const track = TRACKS[mode]
  const [dictId] = useAtom(mode === 'speak' ? speakDictIdAtom : currentDictIdAtom)
  const [chapter, setChapter] = useAtom(mode === 'speak' ? speakChapterAtom : currentChapterAtom)
  const setPracticeMode = useSetAtom(practiceModeAtom)
  const setSrsReview = useSetAtom(srsReviewAtom)
  const { count: dueCount } = useDueReviews(mode === 'speak' ? 'speak' : 'word')
  const startSession = useStartSession()

  const dict = idDictionaryMap[dictId]
  const completed = useCompletedChapters(mode === 'speak' ? speakDictKey(dictId) : dictId)

  const recommendation = useMemo<Recommendation | null>(() => {
    if (!dict || !completed) return null
    // A negative chapter means the last session was a review; resume normal chapters.
    const lastChapter = Math.max(chapter, 0)
    if (!completed.has(lastChapter)) {
      return completed.size === 0 && lastChapter === 0 ? { kind: 'start', chapter: 0 } : { kind: 'continue', chapter: lastChapter }
    }
    if (lastChapter + 1 < dict.chapterCount) {
      return { kind: 'next', chapter: lastChapter + 1, finished: lastChapter }
    }
    return { kind: 'dictDone' }
  }, [completed, chapter, dict])

  const startPractice = (nextChapter: number) => {
    setChapter(nextChapter)
    setPracticeMode(mode)
    setSrsReview({ active: false, words: [] })
    navigate('/practice')
  }

  const isLocked = (dueCount ?? 0) > 0
  const Icon = track.icon

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-gray-700 dark:text-gray-200">
        <Icon className="h-5 w-5 text-indigo-500" />
        <span className="text-lg font-semibold">{track.label}</span>
        <span className="text-sm text-gray-400">{track.hint}</span>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-7 shadow-sm dark:bg-gray-800">
          <p className="text-sm text-gray-400 dark:text-gray-500">{track.reviewTitle}</p>
          {dueCount === undefined ? (
            <p className="mt-3 text-gray-400">正在读取复习计划…</p>
          ) : dueCount > 0 ? (
            <>
              <h2 className="mt-1 text-2xl font-semibold text-red-500">
                {dueCount} {track.unit}待复习
              </h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">{track.reviewHint}</p>
              <button
                type="button"
                autoFocus={mode === 'spell'}
                onClick={() => startSession(mode === 'speak' ? 'speak' : 'word', 'review')}
                className="mt-5 inline-flex items-center rounded-xl bg-indigo-500 px-6 py-3 text-lg font-medium text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-600 dark:shadow-none"
              >
                开始复习
                <IconArrowRight className="ml-2 h-5 w-5" />
              </button>
            </>
          ) : (
            <>
              <h2 className="mt-1 text-2xl font-semibold text-green-600">今天的{mode === 'speak' ? '错音' : ''}复习已完成 ✓</h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">{track.doneHint}</p>
            </>
          )}
        </section>

        <section className={`rounded-2xl bg-white p-7 shadow-sm dark:bg-gray-800 ${isLocked ? 'opacity-60' : ''}`}>
          {dict && (
            <>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                {track.continueLabel} · {dict.category} / {dict.tags.join(' · ')}
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
              <p className="text-gray-700 dark:text-gray-200">这本词典已经全部{track.actionLabel}完了 🎉 从下面选一本继续吧。</p>
            ) : recommendation ? (
              <>
                <p className="text-gray-700 dark:text-gray-200">
                  {recommendation.kind === 'start' && `从${chapterLabel(dict, 0)}开始吧。`}
                  {recommendation.kind === 'continue' &&
                    `上次${track.actionLabel}到${chapterLabel(dict, recommendation.chapter)}，接着来。`}
                  {recommendation.kind === 'next' &&
                    `${chapterLabel(dict, recommendation.finished)}已完成，推荐继续${chapterLabel(dict, recommendation.chapter)}。`}
                </p>
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => startPractice(recommendation.chapter)}
                  className="mt-4 inline-flex items-center rounded-xl bg-indigo-500 px-6 py-3 text-lg font-medium text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-600"
                >
                  {isLocked && <IconLock className="mr-2 h-5 w-5" />}
                  {recommendation.kind === 'start' ? `开始${track.actionLabel}` : `继续${track.actionLabel}`} · 第{' '}
                  {recommendation.chapter + 1} 章{!isLocked && <IconArrowRight className="ml-2 h-5 w-5" />}
                </button>
                {isLocked && <p className="mt-2 text-sm text-gray-400">先完成左边的{track.reviewTitle}</p>}
              </>
            ) : (
              <p className="text-gray-400">正在读取练习进度…</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default function HomePage() {
  const { data: session } = authClient.useSession()
  const { count: dueCount } = useDueReviews()
  const [module, setModule] = useState<ModuleId>('vocabulary')

  const displayName = (session?.user as { displayUsername?: string } | undefined)?.displayUsername || session?.user.name
  // Bank chapters (FIB / WFD) wait for the word review, like typing chapters do.
  const isLocked = (dueCount ?? 0) > 0

  return (
    <Layout>
      <AppNav />
      <div className="flex w-full flex-1 flex-col items-center overflow-y-auto px-10 pb-10">
        <div className="w-full max-w-6xl">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">你好，{displayName}</h1>
              <p className="mt-1 text-gray-500 dark:text-gray-400">PTE 备考 · 拼写和跟读两条线，各自先复习，再学新章节。</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-8">
            <TrackPanel mode="spell" />
            <TrackPanel mode="speak" />
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
              <p className="-mt-4 mb-4 text-sm text-gray-400">点开一本词典，在章节列表上方选「拼写」或「跟读」。</p>
              <DictGrid dicts={pteDictionaries}>
                <BankCards isLocked={isLocked} />
              </DictGrid>
            </section>
          )}
        </div>
      </div>
    </Layout>
  )
}
