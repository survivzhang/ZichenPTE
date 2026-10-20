import { CHAPTER_LENGTH } from '@/constants'
import useStartReview from '@/hooks/useStartReview'
import { currentChapterAtom, currentDictInfoAtom, srsReviewAtom } from '@/store'
import { getUTCUnixTimestamp } from '@/utils'
import { postJSON } from '@/utils/api'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { mutate } from 'swr'

const panelClass = 'flex max-w-md flex-col items-center rounded-2xl bg-white p-8 text-center shadow-sm dark:bg-gray-800'
const primaryButtonClass = 'mt-6 rounded-xl bg-indigo-500 px-6 py-3 text-lg font-medium text-white transition hover:bg-indigo-600'
const secondaryButtonClass = 'mt-3 text-sm text-gray-500 hover:text-indigo-500 dark:text-gray-400'

/** Shown instead of a chapter while today's reviews are not done yet. */
export function ReviewGate({ dueCount }: { dueCount: number }) {
  const startReview = useStartReview()
  const navigate = useNavigate()
  return (
    <div className={panelClass}>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">先完成今天的复习</h2>
      <p className="mt-2 text-gray-500 dark:text-gray-400">今天还有 {dueCount} 个错词要复习，完成后才能学习新内容。</p>
      <button type="button" autoFocus onClick={startReview} className={primaryButtonClass}>
        开始复习 · {dueCount} 词
      </button>
      <button type="button" onClick={() => navigate('/')} className={secondaryButtonClass}>
        返回首页
      </button>
    </div>
  )
}

/** Every word of the chapter was already practiced in another PTE dictionary. */
export function ChapterSkippedPanel() {
  const dict = useAtomValue(currentDictInfoAtom)
  const [chapter, setChapter] = useAtom(currentChapterAtom)
  const isLastChapter = chapter + 1 >= dict.chapterCount

  // Count the chapter as done so the home page moves on past it.
  useEffect(() => {
    postJSON('/records/chapters', {
      dict: dict.id,
      chapter,
      time: 0,
      correctCount: 0,
      wrongCount: 0,
      wordCount: 0,
      correctWordIndexes: [],
      wordNumber: CHAPTER_LENGTH,
      timeStamp: getUTCUnixTimestamp(),
    })
  }, [dict.id, chapter])

  return (
    <div className={panelClass}>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">这一章已经学过了</h2>
      <p className="mt-2 text-gray-500 dark:text-gray-400">第 {chapter + 1} 章的单词都在其他 PTE 词典里练过，已自动跳过。</p>
      {!isLastChapter && (
        <button type="button" autoFocus onClick={() => setChapter(chapter + 1)} className={primaryButtonClass}>
          下一章 · 第 {chapter + 2} 章
        </button>
      )}
    </div>
  )
}

/** End of a daily review session. */
export function ReviewDoneScreen({ total, firstTryCorrect }: { total: number; firstTryCorrect: number }) {
  const setSrsReview = useSetAtom(srsReviewAtom)
  const navigate = useNavigate()

  const finish = () => {
    setSrsReview({ active: false, words: [] })
    mutate('review-due')
    mutate('review-cards')
    navigate('/')
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-indigo-50/60 backdrop-blur-sm dark:bg-gray-900/70">
      <div className={panelClass}>
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">今天的复习完成了 🎉</h2>
        <p className="mt-3 text-gray-600 dark:text-gray-300">
          复习 {total} 词 · 第一遍就对 <span className="font-semibold text-green-600">{firstTryCorrect}</span> · 第一遍错{' '}
          <span className="font-semibold text-red-500">{total - firstTryCorrect}</span>
        </p>
        <p className="mt-1 text-sm text-gray-400">错的词明天会再出现，对的词间隔会越来越长。</p>
        <button type="button" autoFocus onClick={finish} className={primaryButtonClass}>
          返回首页
        </button>
      </div>
    </div>
  )
}
