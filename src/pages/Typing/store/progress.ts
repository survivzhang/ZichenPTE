import type { PracticeProgress, TypingState } from './type'

// Unfinished chapters, per browser. Only a convenience: losing it just means starting the chapter again.
const STORAGE_KEY = 'practiceProgress'
const MAX_SAVED = 20

type Saved = Record<string, PracticeProgress & { savedAt: number }>

function readAll(): Saved {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Saved
  } catch {
    return {}
  }
}

function writeAll(saved: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  } catch {
    // storage full or blocked
  }
}

export function loadProgress(key: string): PracticeProgress | undefined {
  return readAll()[key]
}

export function saveProgress(key: string, state: TypingState) {
  const { words, index, wordCount, correctCount, wrongCount, userInputLogs } = state.chapterData
  const saved = readAll()
  saved[key] = {
    order: words.map((word) => word.name),
    index,
    wordCount,
    correctCount,
    wrongCount,
    userInputLogs,
    time: state.timerData.time,
    savedAt: Date.now(),
  }
  // Keep only the most recent chapters.
  const keys = Object.keys(saved).sort((a, b) => saved[b].savedAt - saved[a].savedAt)
  for (const old of keys.slice(MAX_SAVED)) delete saved[old]
  writeAll(saved)
}

export function clearProgress(key: string) {
  const saved = readAll()
  if (!(key in saved)) return
  delete saved[key]
  writeAll(saved)
}
