import type { LetterMistakes } from './record'
import { ChapterRecord, WordRecord } from './record'
import { TypingContext, TypingStateActionType } from '@/pages/Typing/store'
import type { TypingState } from '@/pages/Typing/store/type'
import { SRS_REVIEW_DICT, currentChapterAtom, currentDictIdAtom, srsReviewAtom } from '@/store'
import type { SessionType } from '@/store'
import { postJSON } from '@/utils/api'
import { useAtomValue } from 'jotai'
import { useCallback, useContext } from 'react'

// Typing records live in the server's database (see server/db/schema.ts); these hooks send them there.

// Records from review sessions are filed under pseudo-dictionaries, apart from real word books.
const sessionDict = (type?: SessionType) => (type === 'fib' ? 'pte-fib' : type === 'wfd' ? 'pte-wfd' : SRS_REVIEW_DICT)

export function useSaveChapterRecord() {
  const currentChapter = useAtomValue(currentChapterAtom)
  const session = useAtomValue(srsReviewAtom)
  const currentDictId = useAtomValue(currentDictIdAtom)
  const dictID = session.active ? sessionDict(session.type) : currentDictId

  const saveChapterRecord = useCallback(
    (typingState: TypingState) => {
      const {
        chapterData: { correctCount, wrongCount, userInputLogs, wordCount, words },
        timerData: { time },
      } = typingState
      const correctWordIndexes = userInputLogs.filter((log) => log.correctCount > 0 && log.wrongCount === 0).map((log) => log.index)

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
  const currentChapter = useAtomValue(currentChapterAtom)
  const currentDictId = useAtomValue(currentDictIdAtom)
  const dictID = session.active ? sessionDict(session.type) : currentDictId

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
