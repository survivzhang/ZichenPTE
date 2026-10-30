import usePronunciationSound from '@/hooks/usePronunciation'
import type { WordWithIndex } from '@/typings'
import { flip, offset, shift, useFloating, useHover, useInteractions, useRole } from '@floating-ui/react'
import { useCallback, useState } from 'react'

export default function WordChip({ word, badge }: { word: WordWithIndex; badge?: string }) {
  const [showTranslation, setShowTranslation] = useState(false)
  const { x, y, strategy, refs, context } = useFloating({
    open: showTranslation,
    onOpenChange: setShowTranslation,
    middleware: [offset(4), shift(), flip()],
  })
  const hover = useHover(context)
  const role = useRole(context, { role: 'tooltip' })
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, role])
  const { play, stop } = usePronunciationSound(word.name, false)
  const isSentence = word.name.includes(' ')

  const onClickWord = useCallback(() => {
    stop()
    play()
  }, [play, stop])

  return (
    <>
      <button
        ref={refs.setReference}
        className={`word-chip select-all ${isSentence ? 'h-auto max-w-full py-1.5 text-left' : ''}`}
        {...getReferenceProps()}
        type="button"
        onClick={onClickWord}
        title={`朗读 ${word.name}`}
      >
        {/* a template sentence wraps in plain text instead of the big monospace word */}
        <span className={isSentence ? '!font-sans !text-base' : ''}>{word.name}</span>
        {badge && <span className="ml-1.5 shrink-0 !text-xs !text-red-500">{badge}</span>}
      </button>
      {showTranslation && (
        <div
          ref={refs.setFloating}
          className="word-chip-tooltip"
          style={{
            position: strategy,
            top: y ?? 0,
            left: x ?? 0,
            width: 'max-content',
          }}
          {...getFloatingProps()}
        >
          {word.trans}
        </div>
      )}
    </>
  )
}
