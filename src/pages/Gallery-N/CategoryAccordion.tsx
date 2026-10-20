import DictionaryComponent from './DictionaryWithoutCover'
import type { Dictionary } from '@/typings'
import type React from 'react'
import { useState } from 'react'
import IconChevronRight from '~icons/tabler/chevron-right'

export type CategoryGroup = {
  category: string
  dictCount: number
  tags: { tag: string; dicts: Dictionary[] }[]
}

export function DictGrid({ dicts, children }: { dicts: Dictionary[]; children?: React.ReactNode }) {
  return (
    <div className="grid gap-x-5 gap-y-10 px-1 pb-4 sm:grid-cols-1 md:grid-cols-2 dic3:grid-cols-3 dic4:grid-cols-4">
      {children}
      {dicts.map((dict) => (
        <DictionaryComponent key={dict.id} dictionary={dict} />
      ))}
    </div>
  )
}

/** "国际考试 / PTE" style heading for a category and tag. */
export function CategoryPath({ category, tag }: { category: string; tag: string }) {
  return (
    <h2 className="text-xl">
      <span className="text-gray-400 dark:text-gray-500">{category} / </span>
      <span className="font-semibold text-indigo-500">{tag}</span>
    </h2>
  )
}

function ToggleRow({
  label,
  count,
  isOpen,
  onToggle,
  size,
}: {
  label: string
  count: number
  isOpen: boolean
  onToggle: () => void
  size: 'category' | 'tag'
}) {
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={onToggle}
      className={`flex w-full items-center rounded-lg px-3 text-left transition-colors hover:bg-indigo-50 dark:hover:bg-gray-800 ${
        size === 'category' ? 'py-3 text-lg font-medium text-gray-700 dark:text-gray-200' : 'py-2 text-gray-600 dark:text-gray-300'
      }`}
    >
      <IconChevronRight className={`mr-2 h-5 w-5 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      <span>{label}</span>
      <span className="ml-3 text-sm font-normal text-gray-400">{count} 本</span>
    </button>
  )
}

/**
 * Categories collapsed by default: click a category to list its tags, click a
 * tag to show its dictionaries. `initialOpen` pre-expands one category/tag,
 * e.g. the one containing the dictionary currently in use.
 */
export default function CategoryAccordion({
  groups,
  initialOpen,
}: {
  groups: CategoryGroup[]
  initialOpen?: { category: string; tag: string }
}) {
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set(initialOpen ? [initialOpen.category] : []))
  const [openTags, setOpenTags] = useState<Set<string>>(() => new Set(initialOpen ? [`${initialOpen.category}/${initialOpen.tag}`] : []))

  const toggle = (setter: typeof setOpenCategories, key: string) =>
    setter((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  return (
    <div className="flex flex-col gap-1">
      {groups.map(({ category, dictCount, tags }) => {
        const isCategoryOpen = openCategories.has(category)
        return (
          <div key={category}>
            <ToggleRow
              label={category}
              count={dictCount}
              isOpen={isCategoryOpen}
              onToggle={() => toggle(setOpenCategories, category)}
              size="category"
            />
            {isCategoryOpen && (
              <div className="ml-6 flex flex-col gap-1 border-l border-gray-200 pl-3 dark:border-gray-700">
                {tags.map(({ tag, dicts }) => {
                  const key = `${category}/${tag}`
                  const isTagOpen = openTags.has(key)
                  return (
                    <div key={key}>
                      <ToggleRow label={tag} count={dicts.length} isOpen={isTagOpen} onToggle={() => toggle(setOpenTags, key)} size="tag" />
                      {isTagOpen && (
                        <div className="mb-4 mt-3 pl-3">
                          <div className="mb-5">
                            <CategoryPath category={category} tag={tag} />
                          </div>
                          <DictGrid dicts={dicts} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
