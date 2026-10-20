import type { IChapterRecord, IReviewRecord, IRevisionDictRecord, IWordRecord, LetterMistakes } from './record'
import { ChapterRecord, ReviewRecord, WordRecord } from './record'
import { TypingContext, TypingStateActionType } from '@/pages/Typing/store'
import type { TypingState } from '@/pages/Typing/store/type'
import { SRS_REVIEW_DICT, currentChapterAtom, currentDictIdAtom, isReviewModeAtom, srsReviewAtom } from '@/store'
import type { SessionType } from '@/store'
import { postJSON } from '@/utils/api'
import type { Table } from 'dexie'
import Dexie from 'dexie'
import { useAtomValue } from 'jotai'
import { useCallback, useContext } from 'react'

class RecordDB extends Dexie {
  wordRecords!: Table<IWordRecord, number>
  chapterRecords!: Table<IChapterRecord, number>
  reviewRecords!: Table<IReviewRecord, number>

  revisionDictRecords!: Table<IRevisionDictRecord, number>
  revisionWordRecords!: Table<IWordRecord, number>

  constructor() {
    super('RecordDB')
    this.version(1).stores({
      wordRecords: '++id,word,timeStamp,dict,chapter,errorCount,[dict+chapter]',
      chapterRecords: '++id,timeStamp,dict,chapter,time,[dict+chapter]',
    })
    this.version(2).stores({
      wordRecords: '++id,word,timeStamp,dict,chapter,wrongCount,[dict+chapter]',
      chapterRecords: '++id,timeStamp,dict,chapter,time,[dict+chapter]',
    })
    this.version(3).stores({
      wordRecords: '++id,word,timeStamp,dict,chapter,wrongCount,[dict+chapter]',
      chapterRecords: '++id,timeStamp,dict,chapter,time,[dict+chapter]',
      reviewRecords: '++id,dict,createTime,isFinished',
    })
  }
}

export const db = new RecordDB()

db.wordRecords.mapToClass(WordRecord)
db.chapterRecords.mapToClass(ChapterRecord)
db.reviewRecords.mapToClass(ReviewRecord)

// Records from review sessions are filed under pseudo-dictionaries, apart from real word books.
const sessionDict = (type?: SessionType) => (type === 'fib' ? 'pte-fib' : type === 'wfd' ? 'pte-wfd' : SRS_REVIEW_DICT)

export function useSaveChapterRecord() {
  const currentChapter = useAtomValue(currentChapterAtom)
  const session = useAtomValue(srsReviewAtom)
  const isSrsReview = session.active
  const isRevision = useAtomValue(isReviewModeAtom) || isSrsReview
  const currentDictId = useAtomValue(currentDictIdAtom)
  const dictID = isSrsReview ? sessionDict(session.type) : currentDictId

  const saveChapterRecord = useCallback(
    (typingState: TypingState) => {
      const {
        chapterData: { correctCount, wrongCount, userInputLogs, wordCount, words, wordRecordIds },
        timerData: { time },
      } = typingState
      const correctWordIndexes = userInputLogs.filter((log) => log.correctCount > 0 && log.wrongCount === 0).map((log) => log.index)

      const chapterRecord = new ChapterRecord(
        dictID,
        isRevision ? -1 : currentChapter,
        time,
        correctCount,
        wrongCount,
        wordCount,
        correctWordIndexes,
        words.length,
        wordRecordIds ?? [],
      )
      db.chapterRecords.add(chapterRecord)
      // wordRecordIds are local IndexedDB ids, meaningless to the server (undefined is dropped from the JSON)
      postJSON('/records/chapters', { ...chapterRecord, wordRecordIds: undefined })
    },
    [currentChapter, dictID, isRevision],
  )

  return saveChapterRecord
}

export type WordKeyLogger = {
  letterTimeArray: number[]
  letterMistake: LetterMistakes
}

export function useSaveWordRecord() {
  const session = useAtomValue(srsReviewAtom)
  const isSrsReview = session.active
  const isRevision = useAtomValue(isReviewModeAtom) || isSrsReview
  const currentChapter = useAtomValue(currentChapterAtom)
  const currentDictId = useAtomValue(currentDictIdAtom)
  const dictID = isSrsReview ? sessionDict(session.type) : currentDictId

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
    }) => {
      const timing = []
      for (let i = 1; i < letterTimeArray.length; i++) {
        const diff = letterTimeArray[i] - letterTimeArray[i - 1]
        timing.push(diff)
      }

      const wordRecord = new WordRecord(word, dictID, isRevision ? -1 : currentChapter, timing, wrongCount, letterMistake)

      // The server turns a first-try mistake into a review card, and grades review answers.
      postJSON('/records/words', {
        ...wordRecord,
        mode: isSrsReview ? session.mode ?? 'review' : 'learn',
        trans,
        usphone,
        ukphone,
        cardId,
      })

      let dbID = -1
      try {
        dbID = await db.wordRecords.add(wordRecord)
      } catch (e) {
        console.error(e)
      }
      if (dispatch) {
        dbID > 0 && dispatch({ type: TypingStateActionType.ADD_WORD_RECORD_ID, payload: dbID })
        dispatch({ type: TypingStateActionType.SET_IS_SAVING_RECORD, payload: false })
      }
    },
    [currentChapter, dictID, dispatch, isRevision, isSrsReview, session.mode],
  )

  return saveWordRecord
}

export function useDeleteWordRecord() {
  const deleteWordRecord = useCallback(async (word: string, dict: string) => {
    try {
      const deletedCount = await db.wordRecords.where({ word, dict }).delete()
      return deletedCount
    } catch (error) {
      console.error(`删除单词记录时出错：`, error)
    }
  }, [])

  return { deleteWordRecord }
}
