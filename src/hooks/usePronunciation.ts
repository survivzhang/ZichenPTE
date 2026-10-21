import { pronunciationConfigAtom } from '@/store'
import type { PronunciationType } from '@/typings'
import { addHowlListener } from '@/utils'
import { romajiToHiragana } from '@/utils/kana'
import { Howl } from 'howler'
import { useAtomValue } from 'jotai'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const pronunciationApi = 'https://dict.youdao.com/dictvoice?audio='
export function generateWordSoundSrc(word: string, pronunciation: Exclude<PronunciationType, false>): string {
  switch (pronunciation) {
    case 'uk':
      return `${pronunciationApi}${word}&type=1`
    case 'us':
      return `${pronunciationApi}${word}&type=2`
    case 'romaji':
      return `${pronunciationApi}${romajiToHiragana(word)}&le=jap`
    case 'zh':
      return `${pronunciationApi}${word}&le=zh`
    case 'ja':
      return `${pronunciationApi}${word}&le=jap`
    case 'de':
      return `${pronunciationApi}${word}&le=de`
    case 'hapin':
    case 'kk':
      return `${pronunciationApi}${word}&le=ru` // 有道不支持哈萨克语, 暂时用俄语发音兜底
    case 'id':
      return `${pronunciationApi}${word}&le=id`
    default:
      return ''
  }
}

export default function usePronunciationSound(word: string, isLoop?: boolean) {
  const pronunciationConfig = useAtomValue(pronunciationConfigAtom)
  const loop = useMemo(() => (typeof isLoop === 'boolean' ? isLoop : pronunciationConfig.isLoop), [isLoop, pronunciationConfig.isLoop])
  const [isPlaying, setIsPlaying] = useState(false)
  const src = generateWordSoundSrc(word, pronunciationConfig.type)

  // A new sound is made as soon as the word changes. (use-sound kept the previous word's
  // sound until the new one had loaded, so playing in between played the old word.)
  const soundRef = useRef<Howl | null>(null)
  const settingsRef = useRef({ loop, volume: pronunciationConfig.volume, rate: pronunciationConfig.rate })
  settingsRef.current = { loop, volume: pronunciationConfig.volume, rate: pronunciationConfig.rate }

  useEffect(() => {
    if (!src) return
    const sound = new Howl({ src: [src], html5: true, format: ['mp3'], ...settingsRef.current })
    soundRef.current = sound
    const unListens = [
      addHowlListener(sound, 'play', () => setIsPlaying(true)),
      addHowlListener(sound, 'end', () => setIsPlaying(false)),
      addHowlListener(sound, 'stop', () => setIsPlaying(false)),
      addHowlListener(sound, 'pause', () => setIsPlaying(false)),
      addHowlListener(sound, 'playerror', () => setIsPlaying(false)),
    ]
    return () => {
      setIsPlaying(false)
      unListens.forEach((unListen) => unListen())
      sound.unload()
      if (soundRef.current === sound) soundRef.current = null
    }
  }, [src])

  useEffect(() => {
    soundRef.current?.loop(loop)
    soundRef.current?.volume(pronunciationConfig.volume)
    soundRef.current?.rate(pronunciationConfig.rate)
  }, [loop, pronunciationConfig.volume, pronunciationConfig.rate])

  const play = useCallback(() => {
    soundRef.current?.play()
  }, [])
  const stop = useCallback(() => {
    soundRef.current?.stop()
  }, [])

  return { play, stop, isPlaying }
}

export function usePrefetchPronunciationSound(word: string | undefined) {
  const pronunciationConfig = useAtomValue(pronunciationConfigAtom)

  useEffect(() => {
    if (!word) return

    const soundUrl = generateWordSoundSrc(word, pronunciationConfig.type)
    if (soundUrl === '') return

    const head = document.head
    const isPrefetch = (Array.from(head.querySelectorAll('link[href]')) as HTMLLinkElement[]).some((el) => el.href === soundUrl)

    if (!isPrefetch) {
      const audio = new Audio()
      audio.src = soundUrl
      audio.preload = 'auto'

      // gpt 说这这两行能尽可能规避下载插件被触发问题。 本地测试不加也可以，考虑到别的插件可能有问题，所以加上保险
      audio.crossOrigin = 'anonymous'
      audio.style.display = 'none'

      head.appendChild(audio)

      return () => {
        head.removeChild(audio)
      }
    }
  }, [pronunciationConfig.type, word])
}
