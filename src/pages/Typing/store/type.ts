import type { WordWithIndex } from '@/typings'
import type { LetterMistakes } from '@/utils/db/record'
import type { ScoredPhoneme } from '@/utils/speech/ipa'

/** How a word went in the speaking track (跟读), kept per word of the chapter. */
export type SpeakWordResult = {
  // the attempt that counts
  firstScore: number | null
  firstPassed: boolean
  // the latest attempt
  lastScore: number | null
  passed: boolean
  phonemes: ScoredPhoneme[]
  // scored by hand because Azure was unavailable
  manual: boolean
  attempts: number
}

export type ChapterData = {
  // warning: 因为有章节内随机的存在，所有记录 index 的场景都应该使用 WordWithIndex.index
  words: WordWithIndex[]
  // chapter index
  index: number
  // 输入的单词数
  wordCount: number
  // 输入正确的单词数
  correctCount: number
  // 输入错误的单词数
  wrongCount: number
  // 每个单词的输入记录
  userInputLogs: UserInputLog[]
  // speaking track: results by index in `words`
  speakResults: Record<number, SpeakWordResult>
}

export type UserInputLog = {
  // the index in ChapterData.words, not the index in WordWithIndex
  index: number
  correctCount: number
  wrongCount: number
  LetterMistakes: LetterMistakes
}

/** An unfinished chapter, kept so that leaving the page and coming back continues where it stopped. */
export type PracticeProgress = {
  // word names in practice order (the chapter may have been shuffled)
  order: string[]
  index: number
  wordCount: number
  correctCount: number
  wrongCount: number
  userInputLogs: UserInputLog[]
  speakResults?: Record<number, SpeakWordResult>
  time: number
}

export type TimerData = {
  time: number
  accuracy: number
  wpm: number
}

export type WrongWordData = {
  name: string
  wrongCount: number
  wrongLetters: Array<{
    letter: string
    count: number
  }>
}

export type TypingState = {
  chapterData: ChapterData
  timerData: TimerData
  isTyping: boolean
  isFinished: boolean
  isShowSkip: boolean
  isTransVisible: boolean
  isLoopSingleWord: boolean
  // 是否正在保存数据
  isSavingRecord: boolean
  // speaking track: re-reading only the chapter's mispronounced words; no chapter record is saved
  isRetryPass: boolean
}
