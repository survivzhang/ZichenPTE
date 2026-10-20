import { CHAPTER_LENGTH } from '@/constants'
import useStartReview, { useStartBankChapter } from '@/hooks/useStartReview'
import { currentChapterAtom, currentDictInfoAtom, srsReviewAtom } from '@/store'
import { getUTCUnixTimestamp } from '@/utils'
import { postJSON } from '@/utils/api'
import { bankChapterTitle, sessionLabel, useBank } from '@/utils/review'
import { useAtom, useAtomValue } from 'jotai'
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
  const [session, setSrsReview] = useAtom(srsReviewAtom)
  const label = sessionLabel(session.type, session.mode, session.title)
  const unit = session.type === 'fib' || session.type === 'wfd' ? '句' : '词'
  const navigate = useNavigate()
  const isBank = session.mode === 'bank' && (session.type === 'fib' || session.type === 'wfd')
  const bankChapters = useBank(session.type === 'fib' ? 'fib' : 'wfd')
  const position = bankChapters?.findIndex((chapter) => chapter.index === session.chapter) ?? -1
  const nextChapter = isBank && position >= 0 ? bankChapters?.[position + 1] : undefined
  const startBankChapter = useStartBankChapter()

  // The finished chapter changed review cards and bank progress.
  const refresh = () => mutate((key) => typeof key === 'string' && (key.startsWith('review-') || key.startsWith('bank-')))

  const finish = () => {
    setSrsReview({ active: false, words: [] })
    refresh()
    navigate('/')
  }

  const goNext = () => {
    if (!nextChapter || (session.type !== 'fib' && session.type !== 'wfd')) return
    refresh()
    startBankChapter(session.type, nextChapter)
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-indigo-50/60 backdrop-blur-sm dark:bg-gray-900/70">
      <div className={panelClass}>
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">{label}完成了 🎉</h2>
        <p className="mt-3 text-gray-600 dark:text-gray-300">
          共 {total} {unit} · 第一遍就对 <span className="font-semibold text-green-600">{firstTryCorrect}</span> · 第一遍错{' '}
          <span className="font-semibold text-red-500">{total - firstTryCorrect}</span>
        </p>
        <p className="mt-1 text-sm text-gray-400">
          {isBank
            ? `第一遍错的${unit}已加入${session.type === 'fib' ? ' FIB' : ' WFD'} 错题，可在「练习中错题」里复习。`
            : '错的明天会再出现，对的间隔会越来越长。'}
        </p>
        {nextChapter ? (
          <>
            <button type="button" autoFocus onClick={goNext} className={primaryButtonClass}>
              下一组 · {bankChapterTitle(nextChapter)}
            </button>
            <button type="button" onClick={finish} className={secondaryButtonClass}>
              返回首页
            </button>
          </>
        ) : (
          <button type="button" autoFocus onClick={finish} className={primaryButtonClass}>
            返回首页
          </button>
        )}
      </div>
    </div>
  )
}
