import { TypingContext, TypingStateActionType } from '../../store'
import type { SpeakWordResult } from '../../store/type'
import Progress from '../Progress'
import InfoBox from '../Speed/InfoBox'
import Translation from '../WordPanel/components/Translation'
import PhonemeStrip from './PhonemeStrip'
import useWordAudio from './useWordAudio'
import { SPEAK_PASS_SCORE, fontSizeConfigAtom, isTextSelectableAtom, speakConfigAtom } from '@/store'
import type { WordWithIndex } from '@/typings'
import { useSaveSpeakRecord } from '@/utils/db'
import type { Assessment, AssessmentHandle } from '@/utils/speech/azure'
import { assessSpeech, openMicrophone } from '@/utils/speech/azure'
import { labelPhonemes } from '@/utils/speech/ipa'
import type { ScoredPhoneme } from '@/utils/speech/ipa'
import { MicCapture } from '@/utils/speech/mic'
import { useAtomValue } from 'jotai'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import IconMicrophone from '~icons/tabler/microphone'
import IconPlayerPlay from '~icons/tabler/player-play'
import IconRefresh from '~icons/tabler/refresh'
import IconVolume from '~icons/tabler/volume'

type Scored = Extract<Assessment, { kind: 'scored' }>

type Phase =
  | { kind: 'idle' }
  | { kind: 'listening' }
  | { kind: 'silence' }
  | { kind: 'scored'; assessment: Scored; phonemes: (ScoredPhoneme & { spoken?: string })[] }
  // Azure (or the microphone) is unavailable: the user marks the word by hand
  | { kind: 'manual'; message: string }
  | { kind: 'manual-done'; passed: boolean }

type Attempt = {
  score: number | null
  passed: boolean
  manual: boolean
  phonemes: ScoredPhoneme[]
  durationMs?: number
}

const AUTO_ADVANCE_MS = 600
const SILENCE_RETRY_MS = 900

/** Input level of the microphone, 0-1, refreshed about ten times a second. */
function useMicLevel(mic: MicCapture | null) {
  const [level, setLevel] = useState(0)
  useEffect(() => {
    if (!mic) return
    const timer = window.setInterval(() => setLevel(mic.level), 100)
    return () => window.clearInterval(timer)
  }, [mic])
  return level
}

function MicLevel({ level }: { level: number }) {
  return (
    <div className="h-1.5 w-40 overflow-hidden rounded-full bg-indigo-100 dark:bg-gray-700">
      <div className="h-full rounded-full bg-indigo-500 transition-[width] duration-100" style={{ width: `${Math.round(level * 100)}%` }} />
    </div>
  )
}

const buttonClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-indigo-400'

/**
 * One word of the speaking track: read it aloud, get scored, see the phonemes.
 * Keyed by the word's index, so every word starts fresh.
 */
function SpeakWord({
  word,
  mic,
  micError,
  micLevel,
  onFinish,
}: {
  word: WordWithIndex
  mic: MicCapture | null
  micError: string | null
  micLevel: number
  onFinish: () => void
}) {
  // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
  const { state, dispatch } = useContext(TypingContext)!
  const { locale } = useAtomValue(speakConfigAtom)
  const fontSizeConfig = useAtomValue(fontSizeConfigAtom)
  const isTextSelectable = useAtomValue(isTextSelectableAtom)
  const saveSpeakRecord = useSaveSpeakRecord()
  const playNative = useWordAudio(word.name, locale)

  const index = state.chapterData.index
  const previous = state.chapterData.speakResults[index] as SpeakWordResult | undefined
  const attemptsRef = useRef(previous?.attempts ?? 0)
  const [phase, setPhase] = useState<Phase>(() => (micError ? { kind: 'manual', message: micError } : { kind: 'idle' }))
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  // consecutive times Azure heard nothing, to hint at a wrong microphone
  const [silences, setSilences] = useState(0)

  const handleRef = useRef<AssessmentHandle | null>(null)
  // set once the word has been marked by hand, so a second Y / N before re-render can't record twice
  const markedRef = useRef(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const advanceTimerRef = useRef<number | null>(null)
  const aliveRef = useRef(true)

  const ipa = locale === 'en-US' ? word.usphone : word.ukphone

  const stopListening = useCallback(() => {
    handleRef.current?.cancel()
    handleRef.current = null
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }, [])

  // Keep the recording so it can be played back against the dictionary audio.
  const startRecorder = useCallback(() => {
    if (!mic || typeof MediaRecorder === 'undefined') return
    try {
      const recorder = new MediaRecorder(mic.stream)
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
      recorder.onstop = () => {
        if (!aliveRef.current || chunks.length === 0) return
        const url = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }))
        setRecordingUrl((old) => {
          if (old) URL.revokeObjectURL(old)
          return url
        })
      }
      recorder.start()
      recorderRef.current = recorder
    } catch {
      // no playback, scoring still works
    }
  }, [mic])

  const finishAttempt = useCallback(
    (attempt: Attempt) => {
      const firstTry = attemptsRef.current === 0 && !state.isRetryPass
      attemptsRef.current += 1
      const result: SpeakWordResult = {
        firstScore: attemptsRef.current === 1 ? attempt.score : previous?.firstScore ?? null,
        firstPassed: attemptsRef.current === 1 ? attempt.passed : previous?.firstPassed ?? false,
        lastScore: attempt.score,
        passed: attempt.passed,
        phonemes: attempt.phonemes,
        manual: attempt.manual,
        attempts: attemptsRef.current,
      }
      dispatch({ type: TypingStateActionType.REPORT_SPEAK_RESULT, payload: { index, result } })
      if (attempt.passed) {
        dispatch({ type: TypingStateActionType.REPORT_CORRECT_WORD })
      } else {
        dispatch({ type: TypingStateActionType.REPORT_WRONG_WORD, payload: { letterMistake: {} } })
      }
      dispatch({ type: TypingStateActionType.SET_IS_SAVING_RECORD, payload: true })
      saveSpeakRecord({
        word: word.name,
        score: attempt.score,
        passed: attempt.passed,
        firstTry,
        manual: attempt.manual,
        phonemes: attempt.phonemes,
        durationMs: attempt.durationMs,
        trans: word.trans,
        usphone: word.usphone,
        ukphone: word.ukphone,
        cardId: word.cardId,
      })
      if (attempt.passed) {
        advanceTimerRef.current = window.setTimeout(onFinish, AUTO_ADVANCE_MS)
      } else {
        playNative()
      }
    },
    [dispatch, index, onFinish, playNative, previous, saveSpeakRecord, state.isRetryPass, word],
  )

  const startListening = useCallback(() => {
    if (!mic) return
    stopListening()
    markedRef.current = false
    setPhase({ kind: 'listening' })
    startRecorder()
    const handle = assessSpeech(mic, word.name, locale)
    handleRef.current = handle
    handle.result
      .then((assessment) => {
        if (!aliveRef.current || handleRef.current !== handle) return
        handleRef.current = null
        const recorder = recorderRef.current
        recorderRef.current = null
        if (recorder && recorder.state !== 'inactive') recorder.stop()
        if (assessment.kind === 'silence') {
          setSilences((n) => n + 1)
          setPhase({ kind: 'silence' })
          return
        }
        setSilences(0)
        const phonemes = labelPhonemes(assessment.phonemes, ipa) as (ScoredPhoneme & { spoken?: string })[]
        setPhase({ kind: 'scored', assessment, phonemes })
        finishAttempt({
          score: assessment.accuracy,
          passed: assessment.passed,
          manual: false,
          phonemes,
          durationMs: assessment.durationMs,
        })
      })
      .catch((error: Error) => {
        if (!aliveRef.current || handleRef.current !== handle) return
        handleRef.current = null
        console.warn('pronunciation assessment unavailable', error)
        markedRef.current = false
        setPhase({ kind: 'manual', message: '评分不可用，请自己判断' })
      })
  }, [finishAttempt, ipa, locale, mic, startRecorder, stopListening, word.name])

  // Listen as soon as the word is shown (and again after a silence), while practice is running.
  useEffect(() => {
    if (!state.isTyping || !mic) return
    if (phase.kind === 'idle') {
      startListening()
    } else if (phase.kind === 'silence') {
      const timer = window.setTimeout(() => setPhase({ kind: 'idle' }), SILENCE_RETRY_MS)
      return () => window.clearTimeout(timer)
    }
  }, [phase.kind, startListening, state.isTyping, mic])

  // Pausing stops the microphone; a result already on screen stays.
  useEffect(() => {
    if (state.isTyping) return
    if (phase.kind === 'listening' || phase.kind === 'silence') {
      stopListening()
      setPhase({ kind: 'idle' })
    }
  }, [phase.kind, state.isTyping, stopListening])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      stopListening()
      if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current)
    }
  }, [stopListening])

  useEffect(
    () => () => {
      if (recordingUrl) URL.revokeObjectURL(recordingUrl)
    },
    [recordingUrl],
  )

  const cancelAutoAdvance = () => {
    if (advanceTimerRef.current) {
      window.clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
  }

  const retry = useCallback(() => {
    if (!state.isTyping || phase.kind === 'manual') return
    cancelAutoAdvance()
    if (!mic) {
      setPhase({ kind: 'manual', message: micError ?? '麦克风不可用，请自己判断' })
      return
    }
    startListening()
  }, [micError, phase.kind, startListening, state.isTyping, mic])

  const next = useCallback(() => {
    if (!state.isTyping || phase.kind === 'manual') return
    cancelAutoAdvance()
    stopListening()
    // Moving on without having read the word counts as not knowing it.
    if (attemptsRef.current === 0) {
      finishAttempt({ score: null, passed: false, manual: false, phonemes: [] })
      cancelAutoAdvance()
    }
    onFinish()
  }, [finishAttempt, onFinish, phase.kind, state.isTyping, stopListening])

  const markByHand = useCallback(
    (passed: boolean) => {
      if (phase.kind !== 'manual' || markedRef.current) return
      markedRef.current = true
      stopListening()
      setPhase({ kind: 'manual-done', passed })
      finishAttempt({ score: null, passed, manual: true, phonemes: [] })
    },
    [finishAttempt, phase.kind, stopListening],
  )

  const playRecording = useCallback(() => {
    if (recordingUrl) new Audio(recordingUrl).play().catch(() => undefined)
  }, [recordingUrl])

  useHotkeys('space', retry, { preventDefault: true }, [retry])
  useHotkeys('enter', next, { preventDefault: true }, [next])
  useHotkeys('p', playNative, { preventDefault: true }, [playNative])
  useHotkeys('r', playRecording, { preventDefault: true }, [playRecording])
  useHotkeys('y', () => markByHand(true), { preventDefault: true }, [markByHand])
  useHotkeys('n', () => markByHand(false), { preventDefault: true }, [markByHand])

  const scored = phase.kind === 'scored' ? phase.assessment : null
  const heard =
    scored &&
    scored.text
      .replace(/[^a-z' ]/gi, '')
      .trim()
      .toLowerCase()
  const misheard = scored && !scored.passed && heard && heard !== word.name.toLowerCase() ? scored.text : null
  const scoreColor = (score: number) => (score >= SPEAK_PASS_SCORE ? 'text-green-600' : score >= 60 ? 'text-amber-500' : 'text-red-500')

  return (
    <div className="flex w-full flex-col items-center">
      <p
        className={`font-mono text-gray-800 dark:text-gray-100 ${isTextSelectable ? 'select-text' : 'select-none'}`}
        style={{ fontSize: `min(${fontSizeConfig.foreignFont}px, 9vw)` }}
      >
        {word.name}
      </p>
      {ipa && ipa.length > 1 && (
        <p className={`mt-1 text-sm text-gray-600 dark:text-gray-400 ${isTextSelectable ? 'select-text' : ''}`}>
          {locale === 'en-US' ? 'AmE' : 'BrE'}: [{ipa}]
        </p>
      )}
      <Translation trans={word.trans.join('；')} showTrans={state.isTransVisible} />

      <div className="flex min-h-[9rem] w-full max-w-2xl flex-col items-center justify-start gap-3">
        {phase.kind === 'listening' && (
          <div className="flex flex-col items-center gap-2">
            <p className="flex items-center gap-2 text-lg text-indigo-500">
              <IconMicrophone className="h-6 w-6 animate-pulse" />
              请读出这个词
            </p>
            <MicLevel level={micLevel} />
          </div>
        )}
        {phase.kind === 'silence' && <p className="text-gray-400">没听到声音，再来一次…</p>}
        {silences >= 2 && (phase.kind === 'listening' || phase.kind === 'silence') && (
          <p className="max-w-md text-center text-sm text-amber-600">
            连续没收到声音。说话时上面的音量条应该会动；如果不动，点地址栏左边的图标检查浏览器选的是哪个麦克风，然后刷新页面。
          </p>
        )}
        {phase.kind === 'idle' && state.isTyping && <p className="text-gray-400">正在打开麦克风…</p>}

        {scored && (
          <>
            <p className={`text-4xl font-semibold ${scoreColor(scored.accuracy)}`}>
              {scored.accuracy}
              <span className="ml-2 text-base font-normal text-gray-400">
                {scored.passed ? '及格' : `未及格（${SPEAK_PASS_SCORE} 分及格）`}
              </span>
            </p>
            {misheard && <p className="text-sm text-gray-500">听成了 “{misheard}”</p>}
            {!scored.passed && <PhonemeStrip phonemes={phase.kind === 'scored' ? phase.phonemes : []} />}
          </>
        )}

        {phase.kind === 'manual' && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-amber-600">{phase.message}</p>
            <div className="flex gap-3">
              <button type="button" className={buttonClass} onClick={() => markByHand(true)}>
                ✓ 读对了 <kbd className="text-xs text-gray-400">Y</kbd>
              </button>
              <button type="button" className={buttonClass} onClick={() => markByHand(false)}>
                ✗ 读错了 <kbd className="text-xs text-gray-400">N</kbd>
              </button>
            </div>
          </div>
        )}
        {phase.kind === 'manual-done' && (
          <p className={`text-2xl font-semibold ${phase.passed ? 'text-green-600' : 'text-red-500'}`}>
            {phase.passed ? '✓ 读对了' : '✗ 读错了'}
          </p>
        )}

        {(phase.kind === 'scored' || phase.kind === 'manual-done') && (
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            <button type="button" className={buttonClass} onClick={retry}>
              <IconRefresh className="h-4 w-4" /> 重读 <kbd className="text-xs text-gray-400">空格</kbd>
            </button>
            <button type="button" className={buttonClass} onClick={playNative}>
              <IconVolume className="h-4 w-4" /> 原声 <kbd className="text-xs text-gray-400">P</kbd>
            </button>
            {recordingUrl && (
              <button type="button" className={buttonClass} onClick={playRecording}>
                <IconPlayerPlay className="h-4 w-4" /> 我的录音 <kbd className="text-xs text-gray-400">R</kbd>
              </button>
            )}
            <button type="button" className={`${buttonClass} border-indigo-400 text-indigo-600`} onClick={next}>
              下一个 <kbd className="text-xs text-gray-400">Enter</kbd>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Time and first-try tally for the speaking track (instead of typing speed). */
export function SpeakStats() {
  // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
  const { state } = useContext(TypingContext)!
  const seconds = state.timerData.time % 60
  const minutes = Math.floor(state.timerData.time / 60)
  const results = Object.values(state.chapterData.speakResults)
  const read = results.length
  const firstPassed = results.filter((r) => r.firstPassed).length
  const scores = results.map((r) => r.firstScore).filter((s): s is number => s !== null)
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

  return (
    <div className="my-card flex w-11/12 rounded-xl bg-white p-2 py-6 opacity-50 transition-colors duration-300 dark:bg-gray-800 sm:w-3/5 sm:p-4 sm:py-10">
      <InfoBox info={`${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds}`} description="时间" />
      <InfoBox info={read + ''} description="已读" />
      <InfoBox info={firstPassed + ''} description="第一遍及格" />
      <InfoBox info={read ? Math.round((firstPassed / read) * 100) + '' : '0'} description="第一遍正确率" />
      <InfoBox info={average + ''} description="平均分" />
    </div>
  )
}

/** The speaking track's practice screen: holds the microphone and shows one word at a time. */
export default function SpeakPanel() {
  // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
  const { state, dispatch } = useContext(TypingContext)!
  const [mic, setMic] = useState<MicCapture | null>(null)
  const [micError, setMicError] = useState<string | null>(null)
  const micLevel = useMicLevel(mic)
  const currentWord = state.chapterData.words[state.chapterData.index]

  // Ask for the microphone when practice starts, and keep it for the whole chapter.
  useEffect(() => {
    if (!state.isTyping || mic || micError) return
    let cancelled = false
    openMicrophone()
      .then((s) => {
        if (cancelled) s.getTracks().forEach((t) => t.stop())
        else setMic(new MicCapture(s))
      })
      .catch((error: Error) => {
        if (cancelled) return
        console.error('microphone unavailable', error)
        setMicError(
          error.name === 'NotAllowedError' ? '没有麦克风权限，请在浏览器地址栏允许后刷新；先自己判断' : '麦克风不可用，请自己判断',
        )
      })
    return () => {
      cancelled = true
    }
  }, [micError, state.isTyping, mic])

  useEffect(() => () => mic?.close(), [mic])

  const onFinish = useCallback(() => {
    if (state.chapterData.index < state.chapterData.words.length - 1) {
      dispatch({ type: TypingStateActionType.NEXT_WORD })
    } else {
      dispatch({ type: TypingStateActionType.FINISH_CHAPTER })
    }
  }, [dispatch, state.chapterData.index, state.chapterData.words.length])

  return (
    <div className="container flex h-full w-full flex-col items-center justify-center">
      <div className="container flex flex-grow flex-col items-center justify-center">
        {currentWord && (
          <div className="relative flex w-full justify-center">
            {!state.isTyping && (
              <div className="absolute flex h-full w-full justify-center" data-start-typing>
                <div className="z-10 flex w-full items-center backdrop-blur-sm">
                  <p className="w-full select-none text-center text-xl text-gray-600 dark:text-gray-50">
                    按空格{state.timerData.time ? '继续' : '开始'}跟读
                  </p>
                </div>
              </div>
            )}
            <SpeakWord
              key={`${state.chapterData.index}-${currentWord.name}`}
              word={currentWord}
              mic={mic}
              micError={micError}
              micLevel={micLevel}
              onFinish={onFinish}
            />
          </div>
        )}
      </div>
      <Progress className={`mb-10 mt-auto ${state.isTyping ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  )
}
