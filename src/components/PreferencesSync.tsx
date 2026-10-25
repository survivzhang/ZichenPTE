import Loading from '@/components/Loading'
import { idDictionaryMap } from '@/resources/dictionary'
import { currentChapterAtom, currentDictIdAtom, speakChapterAtom, speakDictIdAtom } from '@/store'
import { getJSON, putJSON } from '@/utils/api'
import { useAtom } from 'jotai'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

type Preferences = {
  currentDict: string | null
  currentChapter: number | null
  speakDict: string | null
  speakChapter: number | null
}

/**
 * Keeps the current dictionary and chapter on the signed-in account, so they
 * follow the user across browsers and devices. Renders nothing until the saved
 * choice has been loaded, to avoid briefly showing the default dictionary.
 */
export default function PreferencesSync({ children }: { children: ReactNode }) {
  const [currentDictId, setCurrentDictId] = useAtom(currentDictIdAtom)
  const [currentChapter, setCurrentChapter] = useAtom(currentChapterAtom)
  const [speakDictId, setSpeakDictId] = useAtom(speakDictIdAtom)
  const [speakChapter, setSpeakChapter] = useAtom(speakChapterAtom)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    getJSON<Preferences>('/preferences').then((prefs) => {
      if (cancelled) return
      // Ignore a saved dictionary that no longer exists. With nothing saved yet,
      // keep this browser's current choice; the effect below then saves it.
      if (prefs?.currentDict && idDictionaryMap[prefs.currentDict]) {
        setCurrentDictId(prefs.currentDict)
        setCurrentChapter(prefs.currentChapter ?? 0)
      }
      if (prefs?.speakDict && idDictionaryMap[prefs.speakDict]) {
        setSpeakDictId(prefs.speakDict)
        setSpeakChapter(prefs.speakChapter ?? 0)
      }
      setIsLoaded(true)
    })
    return () => {
      cancelled = true
    }
    // Load once per sign-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isLoaded) return
    const timer = setTimeout(() => {
      putJSON('/preferences', { currentDict: currentDictId, currentChapter, speakDict: speakDictId, speakChapter })
    }, 500)
    return () => clearTimeout(timer)
  }, [isLoaded, currentDictId, currentChapter, speakDictId, speakChapter])

  return isLoaded ? <>{children}</> : <Loading />
}
