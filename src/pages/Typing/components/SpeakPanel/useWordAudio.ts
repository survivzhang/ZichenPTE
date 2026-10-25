import { generateWordSoundSrc } from '@/hooks/usePronunciation'
import type { SpeakLocale } from '@/store'
import { Howl } from 'howler'
import { useCallback, useEffect, useRef } from 'react'

/** The dictionary recording of a word in the accent the speaking track is scored against. */
export default function useWordAudio(word: string | undefined, locale: SpeakLocale) {
  const soundRef = useRef<Howl | null>(null)
  const src = word ? generateWordSoundSrc(word, locale === 'en-US' ? 'us' : 'uk') : ''

  useEffect(() => {
    if (!src) return
    const sound = new Howl({ src: [src], html5: true, format: ['mp3'] })
    soundRef.current = sound
    return () => {
      sound.unload()
      if (soundRef.current === sound) soundRef.current = null
    }
  }, [src])

  return useCallback(() => {
    soundRef.current?.stop()
    soundRef.current?.play()
  }, [])
}
