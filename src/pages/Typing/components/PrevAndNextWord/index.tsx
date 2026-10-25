import { TypingContext } from '../../store'
import { activeDictInfoAtom } from '@/store'
import { useAtomValue } from 'jotai'
import { useContext, useMemo } from 'react'
import IconPrev from '~icons/tabler/arrow-narrow-left'
import IconNext from '~icons/tabler/arrow-narrow-right'

export default function PrevAndNextWord({ type }: LastAndNextWordProps) {
  // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
  const { state } = useContext(TypingContext)!

  // Shown for context only: a word is never skipped, it has to be typed right first.
  const newIndex = useMemo(() => state.chapterData.index + (type === 'prev' ? -1 : 1), [state.chapterData.index, type])
  const word = state.chapterData.words[newIndex]
  const currentLanguage = useAtomValue(activeDictInfoAtom).language

  const headWord = useMemo(() => {
    if (!word) return ''

    const showWord = ['romaji', 'hapin'].includes(currentLanguage) ? word.notation : word.name

    if (type === 'prev') return showWord

    if (type === 'next') {
      // The next word is the next answer: always masked, since everything is spelled from memory.
      return (showWord || '').replace(/./g, '_')
    }
  }, [word, currentLanguage, type])

  return (
    <>
      {word ? (
        <div className="flex max-w-xs select-none items-center text-gray-700 opacity-60 dark:text-gray-400">
          {type === 'prev' && <IconPrev className="mr-4 shrink-0 grow-0 text-2xl" />}

          <div className={`grow-1 flex w-full flex-col ${type === 'next' ? 'items-end text-right' : ''}`}>
            <p className={`font-mono text-2xl font-normal text-gray-700 dark:text-gray-400 ${'tracking-wider'}`}>{headWord}</p>
            {state.isTransVisible && (
              <p className="line-clamp-1 max-w-full text-sm font-normal text-gray-600 dark:text-gray-500">{word.trans.join('；')}</p>
            )}
          </div>
          {type === 'next' && <IconNext className="ml-4 shrink-0 grow-0 text-2xl" />}
        </div>
      ) : (
        <div />
      )}
    </>
  )
}

export type LastAndNextWordProps = {
  /** 上一个单词还是下一个单词 */
  type: 'prev' | 'next'
}
