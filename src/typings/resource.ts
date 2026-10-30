import type { LanguageCategoryType, LanguageType, PronunciationType } from '.'

export type DictionaryResource = {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  url: string
  length: number
  language: LanguageType
  languageCategory: LanguageCategoryType
  //override default pronunciation when not undefined
  defaultPronIndex?: number
  // practiced only on the 跟读 track (sentences, not words to spell)
  speakOnly?: boolean
  // named chapters of their own sizes, in order, instead of fixed 20-word ones
  chapters?: { name: string; length: number }[]
}

export type Dictionary = {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  url: string
  length: number
  language: LanguageType
  languageCategory: LanguageCategoryType
  // calculated in the store
  chapterCount: number
  //override default pronunciation when not undefined
  defaultPronIndex?: number
  // practiced only on the 跟读 track (sentences, not words to spell)
  speakOnly?: boolean
  // named chapters of their own sizes, in order, instead of fixed 20-word ones
  chapters?: { name: string; length: number }[]
}

export type PronunciationConfig = {
  name: string
  pron: PronunciationType
}

export type LanguagePronunciationMapConfig = {
  defaultPronIndex: number
  pronunciation: PronunciationConfig[]
}

export type LanguagePronunciationMap = {
  [key in LanguageType]: LanguagePronunciationMapConfig
}

export type SoundResource = {
  key: string
  name: string
  filename: string
}
