import type { WordUpdateAction } from '../InputHandler'
import { TypingContext, TypingStateActionType } from '@/pages/Typing/store'
import type { FormEvent } from 'react'
import { useContext, useEffect, useRef, useState } from 'react'

/** Phones and tablets: no physical keyboard, so typing has to go through a focused input that opens the on-screen one. */
export const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

// Taps on these keep their own behaviour instead of opening the keyboard.
const IGNORED_TARGETS = 'a, input, textarea, select, [role="dialog"], [role="listbox"], [role="menu"]'

export default function TouchInputHandler({ updateInput }: { updateInput: (updateObj: WordUpdateAction) => void }) {
  // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
  const { state, dispatch } = useContext(TypingContext)!
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  const isTypingRef = useRef(state.isTyping)
  isTypingRef.current = state.isTyping
  const updateInputRef = useRef(updateInput)
  updateInputRef.current = updateInput

  // What the input held after the last input event. Android keyboards compose a word in place,
  // so new letters are found by comparing against it instead of trusting event.data.
  const lastValueRef = useRef('')
  const isComposingRef = useRef(false)
  // Letters arriving together (a picked suggestion) are fed one per render, since a word checks only its newest letter.
  const queueRef = useRef<string[]>([])
  const pumpRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (pumpRef.current !== null) window.clearTimeout(pumpRef.current)
    },
    [],
  )

  const reset = () => {
    if (inputRef.current) inputRef.current.value = ''
    lastValueRef.current = ''
  }

  const pump = (event: FormEvent<HTMLTextAreaElement>) => {
    const char = queueRef.current.shift()
    pumpRef.current = null
    if (char === undefined) return
    updateInputRef.current({ type: 'add', value: char, event })
    if (queueRef.current.length > 0) pumpRef.current = window.setTimeout(() => pump(event), 16)
  }

  const onInput = (e: FormEvent<HTMLTextAreaElement>) => {
    const value = e.currentTarget.value
    const last = lastValueRef.current
    const added = value.startsWith(last) ? value.slice(last.length).replace(/\n/g, '') : ''
    lastValueRef.current = value
    if (!isComposingRef.current) reset()
    if (!added) return

    if (!isTypingRef.current) {
      // Like the physical keyboard: the first key only starts practice.
      dispatch({ type: TypingStateActionType.SET_IS_TYPING, payload: true })
      return
    }
    queueRef.current.push(...added.split(''))
    if (pumpRef.current === null) pump(e)
  }

  // A tap anywhere on the page opens the keyboard while practising, and so does tapping to start.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null
      if (!target || target.closest(IGNORED_TARGETS)) return
      if (isTypingRef.current || target.closest('[aria-label="开始"], [data-start-typing]')) inputRef.current?.focus()
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  useEffect(() => {
    if (state.isTyping) {
      inputRef.current?.focus()
    } else {
      inputRef.current?.blur()
      queueRef.current = []
    }
  }, [state.isTyping])

  return (
    <>
      <textarea
        ref={inputRef}
        // 16px stops iOS from zooming in on focus; the input itself stays invisible.
        className="pointer-events-none fixed bottom-0 left-0 h-px w-px resize-none overflow-hidden border-0 p-0 text-base opacity-0"
        aria-label="输入"
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onInput={onInput}
        onCompositionStart={() => (isComposingRef.current = true)}
        onCompositionEnd={() => {
          isComposingRef.current = false
          reset()
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false)
          isComposingRef.current = false
          reset()
        }}
      />
      {state.isTyping && !isFocused && (
        <button
          type="button"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-indigo-500 px-5 py-2 text-sm text-white shadow-lg"
        >
          点这里打开键盘
        </button>
      )}
    </>
  )
}
