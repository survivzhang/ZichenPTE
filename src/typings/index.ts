export * from './resource'

export type PronunciationType = 'us' | 'uk' | 'romaji' | 'zh' | 'ja' | 'de' | 'hapin' | 'kk' | 'id'
export type PhoneticType = 'us' | 'uk' | 'romaji' | 'zh' | 'ja' | 'de' | 'hapin' | 'kk' | 'id'
export type LanguageType = 'en' | 'romaji' | 'zh' | 'ja' | 'code' | 'de' | 'kk' | 'hapin' | 'id'
export type LanguageCategoryType = 'en' | 'ja' | 'de' | 'code' | 'kk' | 'id'

type Pronunciation2PhoneticMap = Record<PronunciationType, PhoneticType>

export const PRONUNCIATION_PHONETIC_MAP: Pronunciation2PhoneticMap = {
  us: 'us',
  uk: 'uk',
  romaji: 'romaji',
  zh: 'zh',
  ja: 'ja',
  de: 'de',
  hapin: 'hapin',
  kk: 'kk',
  id: 'id',
}

export type Word = {
  name: string
  trans: string[]
  usphone: string
  ukphone: string
  notation?: string
  // PTE practice items. fib: `name` is the blank's answer, shown inside its sentence;
  // wfd: `name` is the whole sentence (lowercase, no punctuation), dictated from audio.
  kind?: 'fib' | 'wfd'
  context?: { before: string; after: string }
  // what the speaker reads: the full sentence for fib/wfd
  speakText?: string
  // review card this item came from, so the answer grades that card
  cardId?: number
  // question-bank item this came from; a first-try mistake makes it a review card
  itemId?: number
}

export type WordWithIndex = Word & {
  // 在 chapter 中的原始索引
  index: number
}

export type InfoPanelType = 'donate' | 'vsc' | 'community' | 'redBook'

export type InfoPanelState = {
  [key in InfoPanelType]: boolean
}

export type LoopWordTimesOption = 1 | 3 | 5 | 8 | typeof Number.MAX_SAFE_INTEGER

export type WordDictationType = 'hideAll' | 'hideVowel' | 'hideConsonant' | 'randomHide'
/**
 * 标记用户是手动打开默写模式，还是通过点击 resultScreen 中的默写本章按钮打开的
 *
 * 预期行为是，在进入下一章节时，如果是手动打开的默写模式，则保持设定
 * 如果是通过点击 resultScreen 中的默写本章按钮打开的，则关闭默写模式
 */
export type WordDictationOpenBy = 'user' | 'auto'
