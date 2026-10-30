// Pronunciation assessment in the browser with the Azure Speech SDK. The server
// hands out short-lived tokens (/api/speech/token); the subscription key stays there.
import type { ScoredPhoneme } from './ipa'
import type { MicCapture } from './mic'
import { TARGET_SAMPLE_RATE } from './mic'
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
  | { kind: 'silence'; diagnostics: Diagnostics }
  | {
      kind: 'scored'
      // what Azure heard
      text: string
      // the headline score, 0-100: Azure's PronScore, which weighs accuracy, fluency,
      // completeness and (en-US) prosody, so halting or flat reading costs points like in PTE
      score: number
      // its parts; prosody is null for en-GB, where Azure doesn't assess it
      accuracy: number
      fluency: number
      prosody: number | null
      words: AssessedWord[]
      passed: boolean
      // why it didn't pass, e.g. "about 53 分" or "流利 72"
      failures: string[]
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
type AzureScores = { AccuracyScore?: number; FluencyScore?: number; ProsodyScore?: number; PronScore?: number }
type AzureResult = {
  Duration?: number
  NBest?: { Display?: string; PronunciationAssessment?: AzureScores; Words?: AzureWord[] }[]
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
  const scores = best?.PronunciationAssessment ?? {}
  const accuracy = Math.round(scores.AccuracyScore ?? 0)
  const fluency = Math.round(scores.FluencyScore ?? 0)
  const prosody = scores.ProsodyScore === undefined ? null : Math.round(scores.ProsodyScore)
  const score = Math.round(scores.PronScore ?? accuracy)
  const weakParts = (
    [
      ['准确', accuracy],
      ['流利', fluency],
      ['语调', prosody],
    ] as const
  )
    .filter(([, value]) => value !== null && value < SPEAK_PASS_SCORE)
    .map(([label, value]) => `${label} ${value}`)
  // The whole reading has to reach the pass mark, and every reference word has to be said well enough.
  const failures = [
    ...(words.length === 0 ? ['没听到要读的词'] : []),
    ...(score < SPEAK_PASS_SCORE ? [`总分 ${score}${weakParts.length ? `（${weakParts.join('、')}）` : ''}`] : []),
    ...words
      .filter((w) => w.errorType === 'Omission' || w.accuracy < SPEAK_PASS_SCORE)
      .map((w) => (w.errorType === 'Omission' ? `${w.word} 漏读` : `${w.word} ${w.accuracy} 分`)),
  ]
  return {
    text: best?.Display ?? '',
    score,
    accuracy,
    fluency,
    prosody,
    words,
    passed: failures.length === 0,
    failures,
    phonemes: words.flatMap((w) => w.phonemes),
    // Duration is in 100-nanosecond ticks
    durationMs: Math.round((result.Duration ?? 0) / 10_000),
  }
}

export type AssessmentHandle = { result: Promise<Assessment>; cancel: () => void }

// A recognition that neither finishes nor fails within this long is treated as unavailable,
// so the practice never hangs on "listening".
const RECOGNITION_TIMEOUT_MS = 20_000

const log = (...args: unknown[]) => console.log('[speak]', ...args)

/** What happened during one recognition, shown on screen when Azure hears nothing. */
export type Diagnostics = {
  // seconds of audio pushed to the SDK and the loudest sample (0-1) in it
  audioSeconds: number
  peak: number
  // SDK events in order, e.g. "session", "speech-start", "no-match:InitialSilenceTimeout"
  events: string[]
}

/**
 * Listen on the microphone for one utterance of `referenceText` and score it.
 * Resolves to `silence` when nothing was said within a few seconds.
 * Rejects with SpeechUnavailable when Azure can't be reached, so the caller
 * can fall back to marking the word by hand.
 */
export function assessSpeech(mic: MicCapture, referenceText: string, locale: SpeakLocale): AssessmentHandle {
  let cancelled = false
  let close: (() => void) | null = null

  const diagnostics: Diagnostics = { audioSeconds: 0, peak: 0, events: [] }
  const silence = (): Assessment => ({ kind: 'silence', diagnostics })
  const note = (event: string) => {
    diagnostics.events.push(event)
    log(event)
  }

  const result = (async (): Promise<Assessment> => {
    const [sdk, token] = await Promise.all([loadSdk(), getToken()])
    if (cancelled) return silence()
    mic.resume()
    note(`mic ${mic.context.state} @${mic.context.sampleRate}Hz`)

    const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token.token, token.region)
    speechConfig.speechRecognitionLanguage = locale
    // Wait up to 6 s for the first sound. The phrase ends after 1 s of silence; a shorter
    // end-silence (the deprecated EndSilenceTimeoutMs, 800 ms) made the service give up on
    // single words with NoMatch:NotRecognized right after it had heard them.
    speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, '6000')
    // A sentence gets a little longer, so a breath at a comma doesn't end it.
    speechConfig.setProperty(sdk.PropertyId.Speech_SegmentationSilenceTimeoutMs, referenceText.includes(' ') ? '1500' : '1000')

    // Audio is pushed from our own capture (see mic.ts), not the SDK's microphone input.
    const pushStream = sdk.AudioInputStream.createPushStream(sdk.AudioStreamFormat.getWaveFormatPCM(TARGET_SAMPLE_RATE, 16, 1))
    const unsubscribe = mic.subscribe((pcm) => {
      pushStream.write(pcm)
      diagnostics.audioSeconds += pcm.byteLength / 2 / TARGET_SAMPLE_RATE
      const samples = new Int16Array(pcm)
      for (let i = 0; i < samples.length; i += 8) diagnostics.peak = Math.max(diagnostics.peak, Math.abs(samples[i]) / 0x8000)
    })
    const recognizer = new sdk.SpeechRecognizer(speechConfig, sdk.AudioConfig.fromStreamInput(pushStream))
    close = () => recognizer.close()
    // Breadcrumbs for debugging a session that hears nothing or never returns.
    recognizer.sessionStarted = () => note('session')
    recognizer.speechStartDetected = () => note('speech-start')
    recognizer.speechEndDetected = () => note('speech-end')
    recognizer.recognizing = (_, e) => note(`hearing:${e.result.text}`)
    recognizer.canceled = (_, e) => note(`canceled:${sdk.CancellationReason[e.reason]}:${e.errorCode}:${e.errorDetails}`)

    const assessment = new sdk.PronunciationAssessmentConfig(
      referenceText,
      sdk.PronunciationAssessmentGradingSystem.HundredMark,
      sdk.PronunciationAssessmentGranularity.Phoneme,
      true,
    )
    // Phoneme names (and what was said instead) and prosody (stress, intonation, rhythm) are only available for en-US.
    if (locale === 'en-US') {
      assessment.phonemeAlphabet = 'IPA'
      assessment.nbestPhonemeCount = 3
      assessment.enableProsodyAssessment = true
    }
    assessment.applyTo(recognizer)

    let timer: number | undefined
    try {
      const recognized = await new Promise<SpeechRecognitionResult>((resolve, reject) => {
        timer = window.setTimeout(() => reject(new SpeechUnavailable('recognition timed out')), RECOGNITION_TIMEOUT_MS)
        recognizer.recognizeOnceAsync(resolve, reject)
      })
      if (cancelled) return silence()
      if (recognized.reason === sdk.ResultReason.NoMatch) {
        note(`no-match:${sdk.NoMatchReason[sdk.NoMatchDetails.fromResult(recognized).reason]}`)
        return silence()
      }
      note(`result:${sdk.ResultReason[recognized.reason]}:${recognized.text}`)
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
      window.clearTimeout(timer)
      unsubscribe()
      pushStream.close()
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
