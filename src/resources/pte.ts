import { dictionaries } from './dictionary'
import type { Dictionary } from '@/typings'

export const PTE_CATEGORY = '国际考试'
export const PTE_TAG = 'PTE'

export const isPteDict = (dict: Dictionary) => dict.category === PTE_CATEGORY && dict.tags.includes(PTE_TAG)

export const pteDictionaries = dictionaries.filter(isPteDict)
export const pteDictIds = pteDictionaries.map((dict) => dict.id)
