import type { LetterMistakes } from './record'
import { ChapterRecord, WordRecord } from './record'
import { TypingContext, TypingStateActionType } from '@/pages/Typing/store'
import type { TypingState } from '@/pages/Typing/store/type'
import {
  SRS_REVIEW_DICT,
  activeChapterAtom,
  activeDictIdAtom,
  practiceModeAtom,
  speakConfigAtom,
  speakDictKey,
  srsReviewAtom,
} from '@/store'
import type { SessionType } from '@/store'
import { getUTCUnixTimestamp } from '@/utils'
import { postJSON } from '@/utils/api'
import type { ScoredPhoneme } from '@/utils/speech/ipa'
import { useAtomValue } from 'jotai'
import { useCallback, useContext } from 'react'

// Typing records live in the server's database (see server/db/schema.ts); these hooks send them there.

// Records from review sessions are filed under pseudo-dictionaries, apart from real word books.
const sessionDict = (type?: SessionType) =>
  type === 'fib' ? 'pte-fib' : type === 'wfd' ? 'pte-wfd' : type === 'speak' ? speakDictKey(SRS_REVIEW_DICT) : SRS_REVIEW_DICT

/** Whether the practice page is on the speaking track (a speak chapter or a speak review). */
export function useIsSpeakTrack() {
  const session = useAtomValue(srsReviewAtom)
  const mode = useAtomValue(practiceModeAtom)
  return session.active ? session.type === 'speak' : mode === 'speak'
}

/** The dictionary key records of the current chapter or session are filed under. */
function useRecordDict() {
  const session = useAtomValue(srsReviewAtom)
  const activeDictId = useAtomValue(activeDictIdAtom)
  const isSpeak = useIsSpeakTrack()
  if (session.active) return sessionDict(session.type)
  return isSpeak ? speakDictKey(activeDictId) : activeDictId
}

export function useSaveChapterRecord() {
  const currentChapter = useAtomValue(activeChapterAtom)
  const session = useAtomValue(srsReviewAtom)
  const dictID = useRecordDict()

  const saveChapterRecord = useCallback(
    (typingState: TypingState) => {
      const {
        chapterData: { correctCount, wrongCount, userInputLogs, wordCount, words },
        timerData: { time },
      } = typingState
      const correctWordIndexes = userInputLogs.filter((log) => log.correctCount > 0 && log.wrongCount === 0).map((log) => log.index)

      // Re-reading a speak chapter's wrong words is not a chapter of its own.
      if (typingState.isRetryPass) return
      const chapterRecord = new ChapterRecord(
        dictID,
        session.active ? (session.mode === 'bank' ? session.chapter ?? -1 : -1) : currentChapter,
        time,
        correctCount,
        wrongCount,
        wordCount,
        correctWordIndexes,
        words.length,
      )
      postJSON('/records/chapters', chapterRecord)
    },
    [currentChapter, dictID, session.active, session.mode, session.chapter],
  )

  return saveChapterRecord
}

export type WordKeyLogger = {
  letterTimeArray: number[]
  letterMistake: LetterMistakes
}

export function useSaveWordRecord() {
  const session = useAtomValue(srsReviewAtom)
  const currentChapter = useAtomValue(activeChapterAtom)
  const dictID = useRecordDict()

  const { dispatch } = useContext(TypingContext) ?? {}

  const saveWordRecord = useCallback(
    async ({
      word,
      wrongCount,
      letterTimeArray,
      letterMistake,
      trans,
      usphone,
      ukphone,
      cardId,
      itemId,
    }: {
      word: string
      wrongCount: number
      letterTimeArray: number[]
      letterMistake: LetterMistakes
      // sent to the server so a review card can show the meaning
      trans?: string[]
      usphone?: string
      ukphone?: string
      cardId?: number
      itemId?: number
    }) => {
      const timing = []
      for (let i = 1; i < letterTimeArray.length; i++) {
        const diff = letterTimeArray[i] - letterTimeArray[i - 1]
        timing.push(diff)
      }

      const wordRecord = new WordRecord(word, dictID, session.active ? -1 : currentChapter, timing, wrongCount, letterMistake)

      // The server turns a first-try mistake into a review card, and grades review answers.
      await postJSON('/records/words', {
        ...wordRecord,
        mode: session.active && session.mode !== 'bank' ? session.mode ?? 'review' : 'learn',
        trans,
        usphone,
        ukphone,
        cardId,
        itemId,
      })
      // The chapter record is saved once the last word's record is in.
      dispatch?.({ type: TypingStateActionType.SET_IS_SAVING_RECORD, payload: false })
    },
    [currentChapter, dictID, dispatch, session.active, session.mode],
  )

  return saveWordRecord
}

export type SpeakAttemptRecord = {
  word: string
  score: number | null
  passed: boolean
  firstTry: boolean
  manual: boolean
  phonemes: ScoredPhoneme[]
  durationMs?: number
  trans?: string[]
  usphone?: string
  ukphone?: string
  cardId?: number
}

/** Send one attempt at reading a word aloud; the server grades the speak card on the first try. */
export function useSaveSpeakRecord() {
  const session = useAtomValue(srsReviewAtom)
  const currentChapter = useAtomValue(activeChapterAtom)
  const dictID = useRecordDict()
  const { locale } = useAtomValue(speakConfigAtom)
  const { dispatch } = useContext(TypingContext) ?? {}

  return useCallback(
    async ({ phonemes, ...attempt }: SpeakAttemptRecord) => {
      await postJSON('/records/speak', {
        ...attempt,
        // the server only keeps name and score
        phonemes: phonemes.map(({ phoneme, score }) => ({ phoneme, score })),
        dict: dictID,
        chapter: session.active ? -1 : currentChapter,
        locale,
        timeStamp: getUTCUnixTimestamp(),
        mode: session.active ? session.mode ?? 'review' : 'learn',
      })
      dispatch?.({ type: TypingStateActionType.SET_IS_SAVING_RECORD, payload: false })
    },
    [currentChapter, dictID, dispatch, locale, session.active, session.mode],
  )
}
