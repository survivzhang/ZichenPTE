import type { CategoryGroup } from './CategoryAccordion'
import CategoryAccordion, { CategoryPath, DictGrid } from './CategoryAccordion'
import DictRequest from './DictRequest'
import Layout from '@/components/Layout'
import { dictionaries } from '@/resources/dictionary'
import { currentDictInfoAtom } from '@/store'
import groupBy, { groupByDictTags } from '@/utils/groupBy'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { useAtomValue } from 'jotai'
import { useCallback, useMemo, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router-dom'
import IconInfo from '~icons/ic/outline-info'
import IconX from '~icons/tabler/x'

// Shown expanded at the top of the page; everything else is collapsed below it.
const FEATURED = { category: '国际考试', tag: 'PTE' }

const isFeatured = (category: string, tag: string) => category === FEATURED.category && tag === FEATURED.tag

export default function GalleryPage() {
  const navigate = useNavigate()
  const currentDictInfo = useAtomValue(currentDictInfoAtom)

  const { featuredDicts, otherGroups } = useMemo(() => {
    const featuredDicts = dictionaries.filter((dict) => dict.category === FEATURED.category && dict.tags.includes(FEATURED.tag))
    const otherGroups: CategoryGroup[] = Object.entries(groupBy(dictionaries, (dict) => dict.category))
      .map(([category, dicts]) => {
        const tags = Object.entries(groupByDictTags(dicts))
          .filter(([tag]) => !isFeatured(category, tag))
          .map(([tag, tagDicts]) => ({ tag, dicts: tagDicts }))
        // A dictionary can carry several tags; count each one once.
        const dictCount = new Set(tags.flatMap(({ dicts }) => dicts.map((dict) => dict.id))).size
        return { category, dictCount, tags }
      })
      .filter((group) => group.tags.length > 0)
    return { featuredDicts, otherGroups }
  }, [])

  // If the dictionary in use lives in a collapsed section, open that section on arrival.
  const [initialOpen] = useState(() => {
    const tag = currentDictInfo.tags.find((tag) => !isFeatured(currentDictInfo.category, tag))
    return tag && !currentDictInfo.tags.some((t) => isFeatured(currentDictInfo.category, t))
      ? { category: currentDictInfo.category, tag }
      : undefined
  })

  const onBack = useCallback(() => {
    navigate('/')
  }, [navigate])

  useHotkeys('enter,esc', onBack, { preventDefault: true })

  return (
    <Layout>
      <div className="relative mb-auto mt-auto flex w-full flex-1 flex-col overflow-y-auto pl-20">
        <IconX className="absolute right-20 top-10 mr-2 h-7 w-7 cursor-pointer text-gray-400" onClick={onBack} />
        <div className="mt-20 flex w-full flex-1 flex-col items-center justify-center overflow-y-auto">
          <div className="flex h-full flex-col overflow-y-auto">
            <div className="flex h-20 w-full items-center justify-end pb-6 pr-20">
              <DictRequest />
            </div>
            <ScrollArea.Root className="flex-1 overflow-y-auto">
              <ScrollArea.Viewport className="h-full w-full ">
                <div className="mr-4 flex flex-1 flex-col gap-14 overflow-y-auto pr-16">
                  <section>
                    <div className="mb-6">
                      <CategoryPath category={FEATURED.category} tag={FEATURED.tag} />
                    </div>
                    <DictGrid dicts={featuredDicts} />
                  </section>
                  <section>
                    <h2 className="mb-3 text-xl font-semibold text-gray-700 dark:text-gray-200">其他词典</h2>
                    <CategoryAccordion groups={otherGroups} initialOpen={initialOpen} />
                  </section>
                </div>
                <div className="flex items-center justify-center pb-10 pt-[20rem] text-gray-500">
                  <IconInfo className="mr-1 h-5 w-5" />
                  <p className="mr-5 w-10/12 text-xs">
                    本项目的词典数据来自多个开源项目以及社区贡献者的无偿提供。我们深感感激并尊重每一位贡献者的知识产权。
                    这些数据仅供个人学习和研究使用，严禁用于任何商业目的。如果你是数据的版权所有者，并且认为我们的使用方式侵犯了你的权利，请通过网站底部的电子邮件与我们联系。一旦收到有效的版权投诉，我们将在最短的时间内删除相关内容或寻求必要的许可。
                    同时，我们也鼓励所有使用这些数据的人尊重版权所有者的权利，并且在使用这些数据时遵守所有相关的法律和规定。
                    请注意，虽然我们尽力确保所有数据的合法性和准确性，但我们不能对任何数据的准确性、完整性、合法性或可靠性做出任何保证。使用这些数据的风险完全由用户自己承担。
                  </p>
                </div>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar className="flex touch-none select-none bg-transparent " orientation="vertical"></ScrollArea.Scrollbar>
            </ScrollArea.Root>
            {/* todo: 增加导航 */}
            {/* <div className="mt-20 h-40 w-40 text-center ">
                <CategoryNavigation />
              </div> */}
          </div>
        </div>
      </div>
    </Layout>
  )
}
