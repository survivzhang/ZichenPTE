import Layout from '../../components/Layout'
import { DictChapterButton } from './components/DictChapterButton'
import PronunciationSwitcher from './components/PronunciationSwitcher'
import ResultScreen from './components/ResultScreen'
import { ChapterSkippedPanel, ReviewDoneScreen, ReviewGate } from './components/ReviewPanels'
import SpeakLocaleSwitcher from './components/SpeakLocaleSwitcher'
import SpeakPanel, { SpeakStats } from './components/SpeakPanel'
import Speed from './components/Speed'
import StartButton from './components/StartButton'
import Switcher from './components/Switcher'
import WordList from './components/WordList'
import WordPanel from './components/WordPanel'
import { useConfetti } from './hooks/useConfetti'
import { useWordList } from './hooks/useWordList'
import { TypingContext, TypingStateActionType, initialState, typingReducer } from './store'
import { clearProgress, loadProgress, saveProgress } from './store/progress'
import Header from '@/components/Header'
import Tooltip from '@/components/Tooltip'
import { idDictionaryMap } from '@/resources/dictionary'
import { DEFAULT_DICT_ID, activeChapterAtom, activeDictIdAtom, randomConfigAtom, srsReviewAtom } from '@/store'
import { isLegal } from '@/utils'
import { useIsSpeakTrack, useSaveChapterRecord } from '@/utils/db'
import { useDueReviews } from '@/utils/review'
import { useAtom, useAtomValue } from 'jotai'
import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useImmerReducer } from 'use-immer'

const App: React.FC = () => {
  const [state, dispatch] = useImmerReducer(typingReducer, structuredClone(initialState))
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const { words, isChapterAllSkipped } = useWordList()
  const srsReview = useAtomValue(srsReviewAtom)
  // The speaking track (跟读) scores words read aloud instead of typed.
  const isSpeak = useIsSpeakTrack()
  // Learning new words is locked until today's reviews are done: word cards for typing, speak cards for 跟读.
  const gateType = isSpeak ? 'speak' : 'word'
  const { count: dueCount } = useDueReviews(gateType)
  // Bank chapters are new material too, so they wait for the daily review like word books do.
  const isGated = (!srsReview.active || srsReview.mode === 'bank') && (dueCount ?? 0) > 0

  const [currentDictId, setCurrentDictId] = useAtom(activeDictIdAtom)
  const [currentChapter, setCurrentChapter] = useAtom(activeChapterAtom)
  const randomConfig = useAtomValue(randomConfigAtom)
  const saveChapterRecord = useSaveChapterRecord()
  // Which chapter or session this is, for resuming it after leaving the page.
  const progressKey = srsReview.active
    ? `${srsReview.type}:${srsReview.mode}:${srsReview.chapter ?? ''}`
    : `${isSpeak ? 'speak:' : ''}${currentDictId}:${currentChapter}`

  // 在组件挂载和currentDictId改变时，检查当前字典是否存在，如果不存在，则将其重置为默认值
  useEffect(() => {
    const id = currentDictId
    if (!(id in idDictionaryMap)) {
      setCurrentDictId(DEFAULT_DICT_ID)
      setCurrentChapter(0)
      return
    }
  }, [currentDictId, setCurrentChapter, setCurrentDictId])

  const skipWord = useCallback(() => {
    dispatch({ type: TypingStateActionType.SKIP_WORD })
  }, [dispatch])

  // Leaving the window (another app, a screenshot) pauses the timer; coming back resumes it,
  // unless practice was already paused before leaving.
  const isTypingRef = useRef(state.isTyping)
  isTypingRef.current = state.isTyping
  useEffect(() => {
    let pausedByBlur = false
    const onBlur = () => {
      pausedByBlur = isTypingRef.current
      dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: false })
    }
    const onFocus = () => {
      if (pausedByBlur) dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: true })
      pausedByBlur = false
    }
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)

    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [dispatch])

  useEffect(() => {
    state.chapterData.words?.length > 0 ? setIsLoading(false) : setIsLoading(true)
  }, [state.chapterData.words])

  useEffect(() => {
    if (!state.isTyping) {
      const onKeyDown = (e: KeyboardEvent) => {
        // 跟读 starts with the space bar only; letters are shortcuts there
        const starts = isSpeak ? e.key === ' ' : e.key !== 'Enter' && (isLegal(e.key) || e.key === ' ')
        if (!isLoading && !isGated && starts && !e.altKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: true })
        }
      }
      window.addEventListener('keydown', onKeyDown)

      return () => window.removeEventListener('keydown', onKeyDown)
    }
  }, [state.isTyping, isLoading, isGated, isSpeak, dispatch])

  useEffect(() => {
    if (words !== undefined) {
      dispatch({
        type: TypingStateActionType.SETUP_CHAPTER,
        payload: { words, shouldShuffle: randomConfig.isOpen, progress: loadProgress(progressKey) },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words])

  // Save the unfinished chapter after every item; a finished one starts from the beginning next time.
  useEffect(() => {
    if (state.isFinished) {
      clearProgress(progressKey)
    } else if (state.chapterData.words.length > 0 && (state.chapterData.index > 0 || state.chapterData.wordCount > 0)) {
      saveProgress(progressKey, state)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.chapterData.index, state.chapterData.wordCount, state.isFinished])

  useEffect(() => {
    // 当用户完成章节后且完成 word Record 数据保存，记录 chapter Record 数据,
    if (state.isFinished && !state.isSavingRecord) {
      saveChapterRecord(state)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isFinished, state.isSavingRecord])

  useEffect(() => {
    // 启动计时器
    let intervalId: number
    if (state.isTyping) {
      intervalId = window.setInterval(() => {
        dispatch({ type: TypingStateActionType.TICK_TIMER })
      }, 1000)
    }
    return () => clearInterval(intervalId)
  }, [state.isTyping, dispatch])

  useConfetti(state.isFinished)

  return (
    <TypingContext.Provider value={{ state: state, dispatch }}>
      {state.isFinished && !srsReview.active && <ResultScreen />}
      {state.isFinished && srsReview.active && (
        <ReviewDoneScreen
          total={state.chapterData.words.length}
          firstTryCorrect={state.chapterData.userInputLogs.filter((log) => log.correctCount > 0 && log.wrongCount === 0).length}
        />
      )}
      <Layout>
        <Header>
          <DictChapterButton />
          {isSpeak ? <SpeakLocaleSwitcher /> : <PronunciationSwitcher />}
          <Switcher speak={isSpeak} />
          <StartButton isLoading={isLoading || isGated} enterToggles={!isSpeak} />
          {!isSpeak && (
            <Tooltip content="跳过该词">
              <button
                className={`${
                  state.isShowSkip ? 'bg-orange-400' : 'invisible w-0 bg-gray-300 px-0 opacity-0'
                } my-btn-primary transition-all duration-300 `}
                onClick={skipWord}
              >
                Skip
              </button>
            </Tooltip>
          )}
        </Header>
        <div className="container mx-auto flex h-full flex-1 flex-col items-center justify-center pb-5">
          <div className="container relative mx-auto flex h-full flex-col items-center">
            <div className="container flex flex-grow items-center justify-center">
              {isGated ? (
                <ReviewGate dueCount={dueCount ?? 0} type={gateType} />
              ) : isChapterAllSkipped ? (
                <ChapterSkippedPanel />
              ) : isLoading ? (
                <div className="flex flex-col items-center justify-center ">
                  <div
                    className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid  border-indigo-400 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                    role="status"
                  ></div>
                </div>
              ) : (
                !state.isFinished && (isSpeak ? <SpeakPanel /> : <WordPanel />)
              )}
            </div>
            {isSpeak ? <SpeakStats /> : <Speed />}
          </div>
        </div>
      </Layout>
      <WordList />
    </TypingContext.Provider>
  )
}

export default App
