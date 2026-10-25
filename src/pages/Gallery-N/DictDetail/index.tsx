import Chapter from '../Chapter'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { isPteDict } from '@/resources/pte'
import {
  currentChapterAtom,
  currentDictIdAtom,
  practiceModeAtom,
  speakChapterAtom,
  speakDictIdAtom,
  speakDictKey,
  srsReviewAtom,
} from '@/store'
import type { PracticeMode } from '@/store'
import type { Dictionary } from '@/typings'
import range from '@/utils/range'
import { useAtom, useSetAtom } from 'jotai'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MajesticonsPaperFoldTextLine from '~icons/majesticons/paper-fold-text-line'
import IconKeyboard from '~icons/tabler/keyboard'
import IconMicrophone from '~icons/tabler/microphone'

enum Tab {
  Chapters = 'chapters',
}

export default function DictDetail({ dictionary: dict }: { dictionary: Dictionary }) {
  const [currentChapter, setCurrentChapter] = useAtom(currentChapterAtom)
  const [currentDictId, setCurrentDictId] = useAtom(currentDictIdAtom)
  const [speakChapter, setSpeakChapter] = useAtom(speakChapterAtom)
  const [speakDictId, setSpeakDictId] = useAtom(speakDictIdAtom)
  const [practiceMode, setPracticeMode] = useAtom(practiceModeAtom)
  // PTE dictionaries can be practiced on two tracks: typed (拼写) or read aloud (跟读).
  const hasSpeak = isPteDict(dict)
  const [mode, setMode] = useState<PracticeMode>(hasSpeak ? practiceMode : 'spell')
  const [curTab, setCurTab] = useState<Tab>(Tab.Chapters)
  const setSrsReview = useSetAtom(srsReviewAtom)
  const navigate = useNavigate()

  const chapter = useMemo(() => {
    if (mode === 'speak') return dict.id === speakDictId ? speakChapter : 0
    return dict.id === currentDictId ? currentChapter : 0
  }, [currentChapter, currentDictId, dict.id, mode, speakChapter, speakDictId])

  const onChangeChapter = useCallback(
    (index: number) => {
      if (mode === 'speak') {
        setSpeakDictId(dict.id)
        setSpeakChapter(index)
      } else {
        setCurrentDictId(dict.id)
        setCurrentChapter(index)
      }
      setPracticeMode(mode)
      setSrsReview({ active: false, words: [] })
      navigate('/practice')
    },
    [dict.id, mode, navigate, setCurrentChapter, setCurrentDictId, setPracticeMode, setSpeakChapter, setSpeakDictId, setSrsReview],
  )

  const handleTabChange = useCallback(
    (value: Tab) => {
      if (value !== curTab) {
        setCurTab(value)
      }
    },
    [curTab],
  )

  return (
    <div className="flex flex-col rounded-[4rem] px-4 py-3 pl-5 text-gray-800 dark:text-gray-300">
      <div className="text relative flex h-40 flex-col gap-2">
        <h3 className="text-2xl font-semibold">{dict.name}</h3>
        <p className="mt-1">{dict.chapterCount} 章节</p>
        <p>共 {dict.length} 词</p>
        <p>{dict.description}</p>
        {hasSpeak && (
          <div className="absolute bottom-5 left-0">
            <ToggleGroup type="single" value={mode} onValueChange={(value) => value && setMode(value as PracticeMode)}>
              <ToggleGroupItem value="spell" className={`${mode === 'spell' ? 'text-primary-foreground bg-primary' : ''}`}>
                <IconKeyboard className="mr-1.5" />
                拼写
              </ToggleGroupItem>
              <ToggleGroupItem value="speak" className={`${mode === 'speak' ? 'text-primary-foreground bg-primary' : ''}`}>
                <IconMicrophone className="mr-1.5" />
                跟读
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}
        <div className="absolute bottom-5 right-4">
          <ToggleGroup type="single" value={curTab} onValueChange={handleTabChange}>
            <ToggleGroupItem
              value={Tab.Chapters}
              disabled={curTab === Tab.Chapters}
              className={`${curTab === Tab.Chapters ? 'text-primary-foreground bg-primary' : ''} disabled:opacity-100`}
            >
              <MajesticonsPaperFoldTextLine className="mr-1.5 text-gray-500" />
              章节选择
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      <div className="flex pl-0">
        <Tabs value={curTab} className="h-[30rem] w-full ">
          <TabsContent value={Tab.Chapters} className="h-full ">
            <ScrollArea className="h-[30rem] ">
              <div className="flex w-full flex-wrap gap-3">
                {range(0, dict.chapterCount, 1).map((index) => (
                  <Chapter
                    key={`${dict.id}-${mode}-${index}`}
                    index={index}
                    checked={chapter === index}
                    dictID={mode === 'speak' ? speakDictKey(dict.id) : dict.id}
                    onChange={onChangeChapter}
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
