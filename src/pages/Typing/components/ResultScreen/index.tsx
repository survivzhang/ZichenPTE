import { TypingContext, TypingStateActionType, getFirstTryStats } from '../../store'
import ShareButton from '../ShareButton'
import ConclusionBar from './ConclusionBar'
import RemarkRing from './RemarkRing'
import WordChip from './WordChip'
import Tooltip from '@/components/Tooltip'
import { SPEAK_PASS_SCORE, activeChapterAtom, activeDictInfoAtom, randomConfigAtom } from '@/store'
import { useIsSpeakTrack } from '@/utils/db'
import { Transition } from '@headlessui/react'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useContext, useEffect, useMemo } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import IexportWords from '~icons/icon-park-outline/excel'
import IconX from '~icons/tabler/x'

// Phones stack the card: rings in a row, then the word list, then the buttons.
const isNarrow = typeof window !== 'undefined' && window.innerWidth < 640

const ResultScreen = () => {
  // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
  const { state, dispatch } = useContext(TypingContext)!

  const currentDictInfo = useAtomValue(activeDictInfoAtom)
  const [currentChapter, setCurrentChapter] = useAtom(activeChapterAtom)
  const randomConfig = useAtomValue(randomConfigAtom)
  const isSpeak = useIsSpeakTrack()

  useEffect(() => {
    // tick a zero timer to calc the stats
    dispatch({ type: TypingStateActionType.TICK_TIMER, addTime: 0 })
  }, [dispatch])

  const exportWords = useCallback(() => {
    const { words, userInputLogs } = state.chapterData
    const exportData = userInputLogs.map((log) => {
      const word = words[log.index]
      const wordName = word.name
      return {
        ...word,
        trans: word.trans.join(';'),
        correctCount: log.correctCount,
        wrongCount: log.wrongCount,
        wrongLetters: Object.entries(log.LetterMistakes)
          .map(([key, mistakes]) => `${wordName[Number(key)]}:${mistakes.length}`)
          .join(';'),
      }
    })

    import('xlsx')
      .then(({ utils, writeFileXLSX }) => {
        const ws = utils.json_to_sheet(exportData)
        const wb = utils.book_new()
        utils.book_append_sheet(wb, ws, 'Data')
        writeFileXLSX(wb, `${currentDictInfo.name}第${currentChapter + 1}章.xlsx`)
      })
      .catch(() => {
        console.log('写入 xlsx 模块导入失败')
      })
  }, [currentChapter, currentDictInfo.name, state.chapterData])

  const wrongWords = useMemo(() => {
    return state.chapterData.userInputLogs
      .filter((log) => log.wrongCount > 0)
      .map((log) => state.chapterData.words[log.index])
      .filter((word) => word !== undefined)
  }, [state.chapterData.userInputLogs, state.chapterData.words])

  const isLastChapter = useMemo(() => {
    return currentChapter >= currentDictInfo.chapterCount - 1
  }, [currentChapter, currentDictInfo])

  const correctRate = useMemo(() => {
    const chapterLength = state.chapterData.words.length
    const correctCount = chapterLength - wrongWords.length
    return Math.floor((correctCount / chapterLength) * 100)
  }, [state.chapterData.words.length, wrongWords.length])

  const mistakeLevel = useMemo(() => {
    if (correctRate >= 85) {
      return 0
    } else if (correctRate >= 70) {
      return 1
    } else {
      return 2
    }
  }, [correctRate])

  const firstTry = useMemo(() => getFirstTryStats(state), [state])

  const timeString = useMemo(() => {
    const seconds = state.timerData.time
    const minutes = Math.floor(seconds / 60)
    const minuteString = minutes < 10 ? '0' + minutes : minutes + ''
    const restSeconds = seconds % 60
    const secondString = restSeconds < 10 ? '0' + restSeconds : restSeconds + ''
    return `${minuteString}:${secondString}`
  }, [state.timerData.time])

  // Practice is always spelled from memory, so repeating a chapter is the dictation.
  const repeatButtonHandler = useCallback(async () => {
    dispatch({ type: TypingStateActionType.REPEAT_CHAPTER, shouldShuffle: randomConfig.isOpen })
  }, [dispatch, randomConfig.isOpen])

  const nextButtonHandler = useCallback(() => {
    if (!isLastChapter) {
      setCurrentChapter((old) => old + 1)
      dispatch({ type: TypingStateActionType.NEXT_CHAPTER })
    }
  }, [dispatch, isLastChapter, setCurrentChapter])

  const exitButtonHandler = useCallback(() => {
    dispatch({ type: TypingStateActionType.REPEAT_CHAPTER, shouldShuffle: false })
  }, [dispatch])

  // 跟读: read only the words that went wrong, as a pass of their own.
  const retryWrongHandler = useCallback(() => {
    dispatch({ type: TypingStateActionType.RETRY_WRONG_WORDS })
  }, [dispatch])

  // Average of the scores that counted (the first attempt of every word).
  const averageScore = useMemo(() => {
    const scores = Object.values(state.chapterData.speakResults)
      .map((r) => r.firstScore)
      .filter((score): score is number => score !== null)
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  }, [state.chapterData.speakResults])

  // What to show next to a mispronounced word: its first score, or how it was decided without one.
  const speakBadge = (word: (typeof wrongWords)[number]) => {
    const result = state.chapterData.speakResults[state.chapterData.words.indexOf(word)]
    if (!result) return undefined
    if (result.firstScore !== null) return String(result.firstScore)
    return result.manual ? '手动' : '跳过'
  }

  useHotkeys(
    'enter',
    () => {
      nextButtonHandler()
    },
    { preventDefault: true },
  )

  useHotkeys(
    'space',
    (e) => {
      // 火狐浏览器的阻止事件无效，会导致按空格键后 再次输入正确的第一个字母会报错
      e.stopPropagation()
      repeatButtonHandler()
    },
    { preventDefault: true },
  )

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto">
      <div className="absolute inset-0 bg-gray-300 opacity-80 dark:bg-gray-600"></div>
      <Transition
        show={true}
        enter="ease-in duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-out duration-100"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="flex h-screen items-center justify-center">
          <div className="my-card fixed flex max-h-[92vh] w-[92vw] max-w-6xl flex-col overflow-y-auto rounded-3xl bg-white px-4 pb-6 pt-6 shadow-lg dark:bg-gray-800 sm:overflow-hidden sm:pb-14 sm:pl-10 sm:pr-5 sm:pt-10 md:w-4/5 lg:w-3/5">
            <div className="px-6 text-center font-sans text-lg font-normal text-gray-900 dark:text-gray-400 md:text-2xl">
              {isSpeak && <span className="mr-2 rounded-md bg-indigo-500 px-2 py-0.5 text-base text-white">跟读</span>}
              {`${currentDictInfo.name} 第${currentChapter + 1}章`}
              {state.isRetryPass && <span className="ml-2 text-base text-gray-400">· 重读错音词</span>}
            </div>
            <button className="absolute right-4 top-4 sm:right-7 sm:top-5" onClick={exitButtonHandler}>
              <IconX className="text-gray-400" />
            </button>
            <div className="mt-5 flex flex-col gap-4 sm:mt-10 sm:flex-row sm:gap-2 sm:overflow-hidden">
              <div className="flex flex-shrink-0 flex-grow-0 flex-row justify-around gap-2 sm:flex-col sm:gap-3 sm:px-1 md:px-2 lg:px-4">
                <RemarkRing
                  remark={`${firstTry.percent}%`}
                  caption={
                    isNarrow ? `第一遍 ${firstTry.correct}/${firstTry.total}` : `第一遍正确率 · ${firstTry.correct}/${firstTry.total} 词`
                  }
                  percentage={firstTry.percent}
                  size={isNarrow ? 6 : undefined}
                />
                <RemarkRing remark={timeString} caption="章节耗时" size={isNarrow ? 6 : undefined} />
                {isSpeak ? (
                  <RemarkRing
                    remark={averageScore === null ? '—' : averageScore + ''}
                    caption={`平均分 · ${SPEAK_PASS_SCORE} 分及格`}
                    size={isNarrow ? 6 : undefined}
                  />
                ) : (
                  <RemarkRing remark={state.timerData.wpm + ''} caption="WPM" size={isNarrow ? 6 : undefined} />
                )}
              </div>
              <div className="z-10 flex-1 overflow-visible rounded-xl bg-indigo-50 dark:bg-gray-700 sm:ml-6">
                <div className="customized-scrollbar z-20 ml-4 mr-1 flex max-h-56 min-h-[4rem] flex-row flex-wrap content-start gap-3 overflow-y-auto overflow-x-hidden pb-3 pr-3 pt-4 sm:ml-8 sm:h-80 sm:max-h-none sm:gap-4 sm:pr-7 sm:pt-9">
                  {wrongWords.map((word, index) => (
                    <WordChip key={`${index}-${word.name}`} word={word} badge={isSpeak ? speakBadge(word) : undefined} />
                  ))}
                </div>
                <div className="align-center flex w-full flex-row justify-start rounded-b-xl bg-indigo-200 px-4 dark:bg-indigo-400">
                  <ConclusionBar mistakeLevel={mistakeLevel} mistakeCount={wrongWords.length} />
                </div>
              </div>
              {!isSpeak && (
                <div className="ml-2 hidden flex-col items-center justify-end gap-3 text-xl sm:flex">
                  <ShareButton />
                  <IexportWords fontSize={18} className="cursor-pointer text-gray-500" onClick={exportWords}></IexportWords>
                </div>
              )}
            </div>
            <div className="mt-5 flex w-full flex-wrap justify-center gap-3 text-xl sm:mt-10 sm:gap-5 sm:px-5">
              {isSpeak && wrongWords.length > 0 && (
                <button
                  className="my-btn-primary h-12 whitespace-nowrap border-2 border-solid border-indigo-400 bg-white text-base text-indigo-600 dark:bg-gray-600 dark:text-white"
                  type="button"
                  onClick={retryWrongHandler}
                  title="只重读错音词"
                >
                  只重读错音词 · {wrongWords.length}
                </button>
              )}
              <Tooltip content="快捷键：space">
                <button
                  className="my-btn-primary h-12 whitespace-nowrap border-2 border-solid border-gray-300 bg-white text-base text-gray-700 dark:border-gray-700 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-700"
                  type="button"
                  onClick={repeatButtonHandler}
                  title="重复本章节"
                >
                  重复本章节
                </button>
              </Tooltip>
              {!isLastChapter && (
                <Tooltip content="快捷键：enter">
                  <button
                    className={`{ isLastChapter ? 'cursor-not-allowed opacity-50' : ''} my-btn-primary h-12 whitespace-nowrap text-base font-bold `}
                    type="button"
                    onClick={nextButtonHandler}
                    title="下一章节"
                  >
                    下一章节
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </Transition>
    </div>
  )
}

export default ResultScreen
