import atomForConfig from './atomForConfig'
import { DISMISS_START_CARD_DATE_KEY, defaultFontSizeConfig } from '@/constants'
import { idDictionaryMap } from '@/resources/dictionary'
import { correctSoundResources, keySoundResources, wrongSoundResources } from '@/resources/soundResource'
import type {
  Dictionary,
  LoopWordTimesOption,
  PhoneticType,
  PronunciationType,
  Word,
  WordDictationOpenBy,
  WordDictationType,
} from '@/typings'
import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

export const DEFAULT_DICT_ID = 'PTE_junior'

export const currentDictIdAtom = atomWithStorage('currentDict', DEFAULT_DICT_ID)
export const currentDictInfoAtom = atom<Dictionary>((get) => {
  const id = get(currentDictIdAtom)
  let dict = idDictionaryMap[id]
  // 如果 dict 不存在，则返回默认词典. Typing 中会检查 DictId 是否存在，如果不存在则会重置为默认词典
  if (!dict) {
    dict = idDictionaryMap[DEFAULT_DICT_ID]
  }
  return dict
})

export const currentChapterAtom = atomWithStorage('currentChapter', 0)

// ---------------------------------------------------------------------------
// Two independent practice tracks over the same dictionaries: spelling (typing,
// the original) and speaking (跟读: reading words aloud, scored by Azure).
// Each keeps its own dictionary, chapter, records and error bank.
// ---------------------------------------------------------------------------

export type PracticeMode = 'spell' | 'speak'

export const practiceModeAtom = atomWithStorage<PracticeMode>('practiceMode', 'spell')

export const speakDictIdAtom = atomWithStorage('speakDict', DEFAULT_DICT_ID)
export const speakChapterAtom = atomWithStorage('speakChapter', 0)

/** Records of the speaking track are filed under `<dict>@speak`, apart from the typing records. */
export const SPEAK_DICT_SUFFIX = '@speak'
export const speakDictKey = (dictId: string) => `${dictId}${SPEAK_DICT_SUFFIX}`

/** The dictionary of whichever track the practice page is on. */
export const activeDictIdAtom = atom(
  (get) => (get(practiceModeAtom) === 'speak' ? get(speakDictIdAtom) : get(currentDictIdAtom)),
  (get, set, id: string) => {
    set(get(practiceModeAtom) === 'speak' ? speakDictIdAtom : currentDictIdAtom, id)
  },
)

/** The chapter of whichever track the practice page is on. */
export const activeChapterAtom = atom(
  (get) => (get(practiceModeAtom) === 'speak' ? get(speakChapterAtom) : get(currentChapterAtom)),
  (get, set, update: number | ((prev: number) => number)) => {
    const target = get(practiceModeAtom) === 'speak' ? speakChapterAtom : currentChapterAtom
    set(target, typeof update === 'function' ? update(get(target)) : update)
  },
)

export const activeDictInfoAtom = atom<Dictionary>((get) => idDictionaryMap[get(activeDictIdAtom)] ?? idDictionaryMap[DEFAULT_DICT_ID])

export type SpeakLocale = 'en-GB' | 'en-US'

/** Pronunciation assessment settings. Words pass at an accuracy of PASS_SCORE or better. */
export const speakConfigAtom = atomForConfig('speakConfig', {
  locale: 'en-GB' as SpeakLocale,
})
export const SPEAK_PASS_SCORE = 80

export const loopWordConfigAtom = atomForConfig<{ times: LoopWordTimesOption }>('loopWordConfig', {
  times: 1,
})

export const keySoundsConfigAtom = atomForConfig('keySoundsConfig', {
  isOpen: true,
  isOpenClickSound: true,
  volume: 1,
  resource: keySoundResources[0],
})

export const hintSoundsConfigAtom = atomForConfig('hintSoundsConfig', {
  isOpen: true,
  volume: 1,
  isOpenWrongSound: true,
  isOpenCorrectSound: true,
  wrongResource: wrongSoundResources[0],
  correctResource: correctSoundResources[0],
})

// British English became the default on 2026-10-20: switch settings saved before that once.
// Afterwards whatever the user picks is kept.
try {
  if (!localStorage.getItem('britishDefaultsApplied')) {
    const switchToUk = (key: string, extra: Record<string, unknown> = {}) => {
      const saved = localStorage.getItem(key)
      if (saved) localStorage.setItem(key, JSON.stringify({ ...JSON.parse(saved), type: 'uk', ...extra }))
    }
    switchToUk('pronunciation', { name: '英音' })
    switchToUk('phoneticConfig')
    localStorage.setItem('britishDefaultsApplied', '1')
  }
} catch {
  // storage unavailable or malformed; defaults apply
}

export const pronunciationConfigAtom = atomForConfig('pronunciation', {
  isOpen: true,
  volume: 1,
  type: 'uk' as PronunciationType,
  name: '英音',
  isLoop: false,
  isTransRead: false,
  transVolume: 1,
  rate: 1,
})

export const fontSizeConfigAtom = atomForConfig('fontsize', defaultFontSizeConfig)

export const pronunciationIsOpenAtom = atom((get) => get(pronunciationConfigAtom).isOpen)

export const pronunciationIsTransReadAtom = atom((get) => get(pronunciationConfigAtom).isTransRead)

export const randomConfigAtom = atomForConfig('randomConfig', {
  isOpen: false,
})

export const isShowPrevAndNextWordAtom = atomWithStorage('isShowPrevAndNextWord', true)

export const isIgnoreCaseAtom = atomWithStorage('isIgnoreCase', true)

export const isShowAnswerOnHoverAtom = atomWithStorage('isShowAnswerOnHover', true)

export const isTextSelectableAtom = atomWithStorage('isTextSelectable', false)

export const phoneticConfigAtom = atomForConfig('phoneticConfig', {
  isOpen: true,
  type: 'uk' as PhoneticType,
})

export const isOpenDarkModeAtom = atomWithStorage('isOpenDarkModeAtom', window.matchMedia('(prefers-color-scheme: dark)').matches)

export const isShowSkipAtom = atom(false)

export const isInDevModeAtom = atom(false)

export const wordDictationConfigAtom = atomForConfig('wordDictationConfig', {
  isOpen: true,
  type: 'hideAll' as WordDictationType,
  openBy: 'auto' as WordDictationOpenBy,
})

export const dismissStartCardDateAtom = atomWithStorage<Date | null>(DISMISS_START_CARD_DATE_KEY, null)

// Enhanced version promotion popup state
export const hasSeenEnhancedPromotionAtom = atomWithStorage('hasSeenEnhancedPromotion', false)

// for dev test
//   dismissStartCardDateAtom = atom<Date | null>(new Date())

// Records made during the daily review are filed under this pseudo-dictionary.
export const SRS_REVIEW_DICT = 'srs-review'

export type SessionType = 'word' | 'fib' | 'wfd' | 'speak'

/**
 * A session on the practice page that isn't a word-book chapter, kept in memory.
 * - mode review: due review cards (type word = the mandatory daily review; speak = mandatory for the
 *   speaking track; fib/wfd optional)
 * - mode learn: all review cards of a type, practiced outside the schedule
 * - mode bank: a chapter of the user's FIB / WFD question bank (`chapter`, `title`)
 */
export const srsReviewAtom = atom<{
  active: boolean
  words: Word[]
  type?: SessionType
  mode?: 'review' | 'learn' | 'bank'
  chapter?: number
  title?: string
}>({
  active: false,
  words: [],
})

/** Set once the current item has been typed wrong; unlocks hints (hover, audio for FIB, meaning). */
export const hintUnlockedAtom = atom(false)
