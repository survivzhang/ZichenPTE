// Pronunciation assessment in the browser with the Azure Speech SDK. The server
// hands out short-lived tokens (/api/speech/token); the subscription key stays there.
import type { ScoredPhoneme } from './ipa'
import { SPEAK_PASS_SCORE } from '@/store'
import type { SpeakLocale } from '@/store'
import type { SpeechRecognitionResult } from 'microsoft-cognitiveservices-speech-sdk'

/** Azure is not configured, the token could not be fetched, or the service failed. */
export class SpeechUnavailable extends Error {}

export type AssessedWord = {
  word: string
  accuracy: number
  // None | Omission | Mispronunciation (Insertion words are dropped)
  errorType: string
  phonemes: (ScoredPhoneme & { spoken?: string })[]
}

export type Assessment =
  // nothing was said before the timeout
  | { kind: 'silence' }
  | {
      kind: 'scored'
      // what Azure heard
      text: string
      // overall accuracy, 0-100
      accuracy: number
      words: AssessedWord[]
      passed: boolean
      phonemes: AssessedWord['phonemes']
      durationMs: number
    }

type Token = { token: string; region: string; expiresAt: number }

let tokenCache: Token | null = null
let serverSpeechUnavailable = false

async function getToken(): Promise<Token> {
  if (serverSpeechUnavailable) throw new SpeechUnavailable('speech not configured')
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache
  const res = await fetch('/api/speech/token', { credentials: 'same-origin' }).catch(() => null)
  if (!res || !res.ok) {
    // Not configured on the server: don't ask again this session.
    if (res?.status === 503) serverSpeechUnavailable = true
    throw new SpeechUnavailable(`token request failed: ${res?.status ?? 'network'}`)
  }
  tokenCache = (await res.json()) as Token
  return tokenCache
}

/** Ask for the microphone once; the stream is reused for every word. */
export async function openMicrophone(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia not supported')
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false })
}

/** The Azure Speech SDK, loaded on first use (it is large and only the speaking track needs it). */
const loadSdk = () => import('microsoft-cognitiveservices-speech-sdk')

type AzurePhoneme = {
  Phoneme?: string
  PronunciationAssessment?: { AccuracyScore?: number; NBestPhonemes?: { Phoneme: string; Score: number }[] }
}
type AzureWord = {
  Word: string
  PronunciationAssessment?: { AccuracyScore?: number; ErrorType?: string }
  Phonemes?: AzurePhoneme[]
}
type AzureResult = {
  Duration?: number
  NBest?: { Display?: string; PronunciationAssessment?: { AccuracyScore?: number }; Words?: AzureWord[] }[]
}

function parseResult(json: string): Omit<Extract<Assessment, { kind: 'scored' }>, 'kind'> {
  const result = JSON.parse(json) as AzureResult
  const best = result.NBest?.[0]
  const words: AssessedWord[] = (best?.Words ?? [])
    .filter((w) => w.PronunciationAssessment?.ErrorType !== 'Insertion')
    .map((w) => ({
      word: w.Word,
      accuracy: Math.round(w.PronunciationAssessment?.AccuracyScore ?? 0),
      errorType: w.PronunciationAssessment?.ErrorType ?? 'None',
      phonemes: (w.Phonemes ?? []).map((p) => ({
        phoneme: p.Phoneme || null,
        score: Math.round(p.PronunciationAssessment?.AccuracyScore ?? 0),
        spoken: p.PronunciationAssessment?.NBestPhonemes?.[0]?.Phoneme,
      })),
    }))
  // Every reference word has to be said, and said well enough.
  const passed = words.length > 0 && words.every((w) => w.errorType === 'None' && w.accuracy >= SPEAK_PASS_SCORE)
  return {
    text: best?.Display ?? '',
    accuracy: Math.round(best?.PronunciationAssessment?.AccuracyScore ?? 0),
    words,
    passed,
    phonemes: words.flatMap((w) => w.phonemes),
    // Duration is in 100-nanosecond ticks
    durationMs: Math.round((result.Duration ?? 0) / 10_000),
  }
}

export type AssessmentHandle = { result: Promise<Assessment>; cancel: () => void }

/**
 * Listen on `stream` for one utterance of `referenceText` and score it.
 * Resolves to `silence` when nothing was said within a few seconds.
 * Rejects with SpeechUnavailable when Azure can't be reached, so the caller
 * can fall back to marking the word by hand.
 */
export function assessSpeech(stream: MediaStream, referenceText: string, locale: SpeakLocale): AssessmentHandle {
  let cancelled = false
  let close: (() => void) | null = null

  const result = (async (): Promise<Assessment> => {
    const [sdk, token] = await Promise.all([loadSdk(), getToken()])
    if (cancelled) return { kind: 'silence' }

    const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token.token, token.region)
    speechConfig.speechRecognitionLanguage = locale
    // Wait up to 6 s for the first sound, and stop 0.8 s after the word ends.
    speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, '6000')
    speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, '800')

    const recognizer = new sdk.SpeechRecognizer(speechConfig, sdk.AudioConfig.fromStreamInput(stream))
    close = () => recognizer.close()

    const assessment = new sdk.PronunciationAssessmentConfig(
      referenceText,
      sdk.PronunciationAssessmentGradingSystem.HundredMark,
      sdk.PronunciationAssessmentGranularity.Phoneme,
      true,
    )
    // Phoneme names (and what was said instead) are only available for en-US.
    if (locale === 'en-US') {
      assessment.phonemeAlphabet = 'IPA'
      assessment.nbestPhonemeCount = 3
    }
    assessment.applyTo(recognizer)

    try {
      const recognized = await new Promise<SpeechRecognitionResult>((resolve, reject) => recognizer.recognizeOnceAsync(resolve, reject))
      if (cancelled) return { kind: 'silence' }
      if (recognized.reason === sdk.ResultReason.NoMatch) return { kind: 'silence' }
      if (recognized.reason === sdk.ResultReason.Canceled) {
        const details = sdk.CancellationDetails.fromResult(recognized)
        throw new SpeechUnavailable(details.errorDetails || 'recognition canceled')
      }
      const json = recognized.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult)
      if (!json) throw new SpeechUnavailable('no assessment in result')
      return { kind: 'scored', ...parseResult(json) }
    } catch (error) {
      if (error instanceof SpeechUnavailable) throw error
      throw new SpeechUnavailable(String(error))
    } finally {
      recognizer.close()
      close = null
    }
  })()

  return {
    result,
    cancel: () => {
      cancelled = true
      close?.()
    },
  }
}
