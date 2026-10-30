import { useCallback, useEffect, useRef, useState } from 'react'

// Once the server says Azure TTS isn't set up, stop asking and use the browser's voice.
let serverTtsUnavailable = false
const audioUrlCache = new Map<string, string>()

type Accent = 'uk' | 'us'

async function fetchServerAudio(text: string, accent: Accent): Promise<string | null> {
  if (serverTtsUnavailable) return null
  const key = `${accent}\n${text}`
  const cached = audioUrlCache.get(key)
  if (cached) return cached
  try {
    const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}${accent === 'us' ? '&accent=us' : ''}`, {
      credentials: 'same-origin',
    })
    if (res.status === 503) serverTtsUnavailable = true
    if (!res.ok) return null
    const url = URL.createObjectURL(await res.blob())
    audioUrlCache.set(key, url)
    return url
  } catch {
    return null
  }
}

function speakWithBrowser(text: string, accent: Accent, onEnd: () => void) {
  if (!('speechSynthesis' in window)) {
    onEnd()
    return
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  const lang = accent === 'us' ? 'en-US' : 'en-GB'
  utterance.lang = lang
  const voices = window.speechSynthesis.getVoices()
  utterance.voice = voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.startsWith('en')) ?? null
  utterance.rate = 0.95
  utterance.onend = onEnd
  utterance.onerror = onEnd
  window.speechSynthesis.speak(utterance)
}

/** Play a sentence: Azure neural voice from the server when configured, otherwise the browser's voice (British unless `accent` is 'us'). */
export default function useSentenceAudio(text: string | undefined, accent: Accent = 'uk') {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Bumped by every stop, so audio that finishes loading after a stop (or a newer play) is dropped.
  const requestRef = useRef(0)

  const stop = useCallback(() => {
    requestRef.current += 1
    audioRef.current?.pause()
    audioRef.current = null
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setIsPlaying(false)
  }, [])

  const play = useCallback(async () => {
    if (!text) return
    stop()
    const request = requestRef.current
    setIsPlaying(true)
    const url = await fetchServerAudio(text, accent)
    // The sentence changed or playback was stopped while the audio was loading.
    if (request !== requestRef.current) return
    if (url) {
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => setIsPlaying(false)
      audio.onerror = () => setIsPlaying(false)
      audio.play().catch(() => setIsPlaying(false))
    } else {
      speakWithBrowser(text, accent, () => setIsPlaying(false))
    }
  }, [text, accent, stop])

  // Stop when the sentence changes or the component goes away.
  useEffect(() => stop, [text, stop])

  return { play, stop, isPlaying }
}
