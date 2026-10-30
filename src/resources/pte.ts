import { dictionaries } from './dictionary'
import type { Dictionary } from '@/typings'

export const PTE_CATEGORY = '国际考试'
export const PTE_TAG = 'PTE'

export const isPteDict = (dict: Dictionary) => dict.category === PTE_CATEGORY && dict.tags.includes(PTE_TAG)

export const pteDictionaries = dictionaries.filter(isPteDict)
// Dictionaries whose words are skipped when already practiced in another one (not the template sentences).
export const pteDictIds = pteDictionaries.filter((dict) => !dict.chapters).map((dict) => dict.id)
