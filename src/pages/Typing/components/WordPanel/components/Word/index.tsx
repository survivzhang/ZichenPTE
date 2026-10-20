import type { WordUpdateAction } from '../InputHandler'
import InputHandler from '../InputHandler'
import Letter from './Letter'
import Notation from './Notation'
import { TipAlert } from './TipAlert'
import style from './index.module.css'
import { initialWordState } from './type'
import type { WordState } from './type'
import Tooltip from '@/components/Tooltip'
import type { WordPronunciationIconRef } from '@/components/WordPronunciationIcon'
import { WordPronunciationIcon } from '@/components/WordPronunciationIcon'
import { SoundIcon } from '@/components/WordPronunciationIcon/SoundIcon'
import { EXPLICIT_SPACE } from '@/constants'
import useKeySounds from '@/hooks/useKeySounds'
import useSentenceAudio from '@/hooks/useSentenceAudio'
import { TypingContext, TypingStateActionType } from '@/pages/Typing/store'
import {
  currentChapterAtom,
  currentDictInfoAtom,
  hintUnlockedAtom,
  isIgnoreCaseAtom,
  isTextSelectableAtom,
  pronunciationIsOpenAtom,
} from '@/store'
import type { Word } from '@/typings'
import { CTRL, getUtcTimeString } from '@/utils'
import { useSaveWordRecord } from '@/utils/db'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useImmer } from 'use-immer'

export default function WordComponent({ word, onFinish }: { word: Word; onFinish: () => void }) {
  // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
  const { state, dispatch } = useContext(TypingContext)!
  const [wordState, setWordState] = useImmer<WordState>(structuredClone(initialWordState))

  const isTextSelectable = useAtomValue(isTextSelectableAtom)
  const isIgnoreCase = useAtomValue(isIgnoreCaseAtom)
  const saveWordRecord = useSaveWordRecord()
  const [playKeySound, playBeepSound, playHintSound] = useKeySounds()
  const pronunciationIsOpen = useAtomValue(pronunciationIsOpenAtom)
  const [isHoveringWord, setIsHoveringWord] = useState(false)
  const currentLanguage = useAtomValue(currentDictInfoAtom).language
  const currentLanguageCategory = useAtomValue(currentDictInfoAtom).languageCategory
  const currentChapter = useAtomValue(currentChapterAtom)

  const [showTipAlert, setShowTipAlert] = useState(false)
  const wordPronunciationIconRef = useRef<WordPronunciationIconRef>(null)

  // Hints (seeing the answer on hover, FIB audio, the meaning of FIB/WFD) unlock only after a mistake.
  const isHintUnlocked = wordState.hasMadeInputWrong
  const setHintUnlocked = useSetAtom(hintUnlockedAtom)
  useEffect(() => setHintUnlocked(isHintUnlocked), [isHintUnlocked, setHintUnlocked])
  const sentenceAudio = useSentenceAudio(word.speakText)
  const isSentence = word.kind === 'fib' || word.kind === 'wfd'
  // FIB tests the collocation itself, so it stays silent until the first mistake.
  const canPlayAudio = word.kind !== 'fib' || isHintUnlocked
  const playAudio = useCallback(() => {
    if (!canPlayAudio) return
    if (isSentence) {
      sentenceAudio.play()
    } else {
      wordPronunciationIconRef.current?.play()
    }
  }, [canPlayAudio, isSentence, sentenceAudio])

  useEffect(() => {
    // run only when word changes
    let headword = ''
    try {
      headword = word.name.replace(new RegExp(' ', 'g'), EXPLICIT_SPACE)
      headword = headword.replace(new RegExp('…', 'g'), '..')
    } catch (e) {
      console.error('word.name is not a string', word)
      headword = ''
    }

    const newWordState = structuredClone(initialWordState)
    newWordState.displayWord = headword
    newWordState.letterStates = new Array(headword.length).fill('normal')
    newWordState.startTime = getUtcTimeString()
    newWordState.randomLetterVisible = headword.split('').map(() => Math.random() > 0.4)
    setWordState(newWordState)
  }, [word, setWordState])

  const updateInput = useCallback(
    (updateAction: WordUpdateAction) => {
      switch (updateAction.type) {
        case 'add':
          if (wordState.hasWrong) return

          if (updateAction.value === ' ') {
            updateAction.event.preventDefault()
            setWordState((state) => {
              state.inputWord = state.inputWord + EXPLICIT_SPACE
            })
          } else {
            setWordState((state) => {
              state.inputWord = state.inputWord + updateAction.value
            })
          }
          break

        default:
          console.warn('unknown update type', updateAction)
      }
    },
    [wordState.hasWrong, setWordState],
  )

  const handleHoverWord = useCallback((checked: boolean) => {
    setIsHoveringWord(checked)
  }, [])

  useHotkeys(
    'tab',
    () => {
      handleHoverWord(true)
    },
    { enableOnFormTags: true, preventDefault: true },
    [],
  )

  useHotkeys(
    'tab',
    () => {
      handleHoverWord(false)
    },
    { enableOnFormTags: true, keyup: true, preventDefault: true },
    [],
  )
  useHotkeys(
    'ctrl+j',
    () => {
      if (state.isTyping) {
        playAudio()
      }
    },
    [state.isTyping, playAudio],
    { enableOnFormTags: true, preventDefault: true },
  )

  // Read the word (or the WFD sentence) out when it comes up; FIB stays silent.
  useEffect(() => {
    if (wordState.inputWord.length === 0 && state.isTyping && word.kind !== 'fib') {
      if (word.kind === 'wfd') {
        sentenceAudio.play()
      } else {
        wordPronunciationIconRef.current?.play && wordPronunciationIconRef.current?.play()
      }
    }
    // A WFD rollback to the start of a later word must not replay the sentence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isTyping, wordState.inputWord.length === 0, wordPronunciationIconRef.current?.play, word])

  // For sentences: letter indexes grouped by word (each space stays with the word after it).
  const letterGroups = useMemo(() => {
    const groups: number[][] = [[]]
    wordState.displayWord.split('').forEach((letter, index) => {
      if (letter === EXPLICIT_SPACE && groups[groups.length - 1].length > 0) groups.push([])
      groups[groups.length - 1].push(index)
    })
    return groups
  }, [wordState.displayWord])

  // Always spelled from memory: only correctly typed letters show. After the first mistake the
  // answer can be peeked at by hovering or holding Tab, but it never shows on its own.
  const getLetterVisible = useCallback(
    (index: number) => wordState.letterStates[index] === 'correct' || (isHintUnlocked && isHoveringWord),
    [isHintUnlocked, isHoveringWord, wordState.letterStates],
  )

  useEffect(() => {
    const inputLength = wordState.inputWord.length
    /**
     * TODO: 当用户输入错误时，会报错
     * Cannot update a component (`App`) while rendering a different component (`WordComponent`). To locate the bad setState() call inside `WordComponent`, follow the stack trace as described in https://reactjs.org/link/setstate-in-render
     * 目前不影响生产环境，猜测是因为开发环境下 react 会两次调用 useEffect 从而展示了这个 warning
     * 但这终究是一个 bug，需要修复
     */
    if (wordState.hasWrong || inputLength === 0 || wordState.displayWord.length === 0) {
      return
    }

    const inputChar = wordState.inputWord[inputLength - 1]
    const correctChar = wordState.displayWord[inputLength - 1]
    let isEqual = false
    if (inputChar != undefined && correctChar != undefined) {
      isEqual = isIgnoreCase ? inputChar.toLowerCase() === correctChar.toLowerCase() : inputChar === correctChar
    }

    if (isEqual) {
      // 输入正确时
      setWordState((state) => {
        state.letterTimeArray.push(Date.now())
        state.correctCount += 1
      })

      if (inputLength >= wordState.displayWord.length) {
        // 完成输入时
        setWordState((state) => {
          state.letterStates[inputLength - 1] = 'correct'
          state.isFinished = true
          state.endTime = getUtcTimeString()
        })
        playHintSound()
      } else {
        setWordState((state) => {
          state.letterStates[inputLength - 1] = 'correct'
        })
        playKeySound()
      }

      dispatch({ type: TypingStateActionType.REPORT_CORRECT_WORD })
    } else {
      // 出错时
      playBeepSound()
      setWordState((state) => {
        state.letterStates[inputLength - 1] = 'wrong'
        state.hasWrong = true
        state.hasMadeInputWrong = true
        state.wrongCount += 1
        state.wrongCharIndex = inputLength - 1
        state.letterTimeArray = []

        if (state.letterMistake[inputLength - 1]) {
          state.letterMistake[inputLength - 1].push(inputChar)
        } else {
          state.letterMistake[inputLength - 1] = [inputChar]
        }

        const currentState = JSON.parse(JSON.stringify(state))
        dispatch({ type: TypingStateActionType.REPORT_WRONG_WORD, payload: { letterMistake: currentState.letterMistake } })
      })

      if (currentChapter === 0 && state.chapterData.index === 0 && wordState.wrongCount >= 3) {
        setShowTipAlert(true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordState.inputWord])

  useEffect(() => {
    if (wordState.hasWrong) {
      const timer = setTimeout(() => {
        setWordState((state) => {
          // WFD sentences roll back only to the start of the mistyped word, not the whole sentence.
          const keep = word.kind === 'wfd' ? state.inputWord.lastIndexOf(EXPLICIT_SPACE, state.wrongCharIndex - 1) + 1 : 0
          state.inputWord = state.inputWord.slice(0, keep)
          state.letterStates = state.letterStates.map((letterState, i) => (i < keep ? letterState : 'normal'))
          state.hasWrong = false
        })
      }, 300)

      return () => {
        clearTimeout(timer)
      }
    }
  }, [wordState.hasWrong, setWordState, word.kind])

  useEffect(() => {
    if (wordState.isFinished) {
      dispatch({ type: TypingStateActionType.SET_IS_SAVING_RECORD, payload: true })

      saveWordRecord({
        word: word.name,
        wrongCount: wordState.wrongCount,
        letterTimeArray: wordState.letterTimeArray,
        letterMistake: wordState.letterMistake,
        trans: word.trans,
        usphone: word.usphone,
        ukphone: word.ukphone,
        cardId: word.cardId,
      })

      onFinish()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordState.isFinished])

  useEffect(() => {
    if (wordState.wrongCount >= 4) {
      dispatch({ type: TypingStateActionType.SET_IS_SKIP, payload: true })
    }
  }, [wordState.wrongCount, dispatch])

  return (
    <>
      <InputHandler updateInput={updateInput} />
      <div
        lang={currentLanguageCategory !== 'code' ? currentLanguageCategory : 'en'}
        className="flex flex-col items-center justify-center pb-1 pt-4"
      >
        {['romaji', 'hapin'].includes(currentLanguage) && word.notation && <Notation notation={word.notation} />}
        <div
          className={`tooltip-info relative ${
            isSentence ? 'w-full max-w-4xl px-12' : 'w-fit'
          } bg-transparent p-0 leading-normal shadow-none dark:bg-transparent ${isHintUnlocked ? 'tooltip' : ''}`}
          data-tip="按 Tab 快捷键显示完整答案"
        >
          {isSentence ? (
            // FIB: the sentence with the blank to type; WFD: the whole sentence, grouped by word so it wraps between words.
            <div
              onMouseEnter={() => handleHoverWord(true)}
              onMouseLeave={() => handleHoverWord(false)}
              className={`max-w-4xl text-center leading-[2] ${isTextSelectable && 'select-all'} ${wordState.hasWrong ? style.wrong : ''}`}
            >
              {word.context?.before && <span className="text-3xl text-gray-500 dark:text-gray-400">{word.context.before}</span>}
              {letterGroups.map((group, groupIndex) => (
                <span key={groupIndex} className="inline-flex whitespace-nowrap">
                  {group.map((index) => (
                    <Letter
                      key={`${index}-${wordState.displayWord[index]}`}
                      letter={wordState.displayWord[index]}
                      visible={getLetterVisible(index)}
                      state={wordState.letterStates[index]}
                      fontScale={0.6}
                    />
                  ))}
                </span>
              ))}
              {word.context?.after && <span className="text-3xl text-gray-500 dark:text-gray-400">{word.context.after}</span>}
            </div>
          ) : (
            <div
              onMouseEnter={() => handleHoverWord(true)}
              onMouseLeave={() => handleHoverWord(false)}
              className={`flex items-center ${isTextSelectable && 'select-all'} justify-center ${wordState.hasWrong ? style.wrong : ''}`}
            >
              {wordState.displayWord.split('').map((t, index) => {
                return <Letter key={`${index}-${t}`} letter={t} visible={getLetterVisible(index)} state={wordState.letterStates[index]} />
              })}
            </div>
          )}
          {isSentence
            ? canPlayAudio && (
                <div className="absolute -right-12 top-1/2 h-9 w-9 -translate-y-1/2 transform">
                  <Tooltip content={`快捷键${CTRL} + J`}>
                    <SoundIcon
                      animated={sentenceAudio.isPlaying}
                      onClick={sentenceAudio.play}
                      className="h-full w-full cursor-pointer text-gray-600"
                    />
                  </Tooltip>
                </div>
              )
            : pronunciationIsOpen && (
                <div className="absolute -right-12 top-1/2 h-9 w-9 -translate-y-1/2 transform ">
                  <Tooltip content={`快捷键${CTRL} + J`}>
                    <WordPronunciationIcon word={word} lang={currentLanguage} ref={wordPronunciationIconRef} className="h-full w-full" />
                  </Tooltip>
                </div>
              )}
        </div>
      </div>
      <TipAlert className="fixed bottom-10 right-3" show={showTipAlert} setShow={setShowTipAlert} />
    </>
  )
}
