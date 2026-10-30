import { db } from './db/index.js'
import { ttsAudio } from './db/schema.js'
import { eq } from 'drizzle-orm'
import { createHash } from 'node:crypto'

export type Accent = 'uk' | 'us'

// British English by default (WFD); any Azure neural voice name works, e.g. en-AU-NatashaNeural.
// American for the 跟读 track when it scores against en-US.
const voice = (accent: Accent) =>
  accent === 'us' ? process.env.AZURE_TTS_VOICE_US || 'en-US-JennyNeural' : process.env.AZURE_TTS_VOICE || 'en-GB-SoniaNeural'

export const isTtsConfigured = () => Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION)

const escapeXml = (text: string) =>
  text.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string))

/**
 * MP3 audio for `text` from Azure Speech, generated once and then served from
 * the database. Returns null when Azure is not configured.
 */
export async function synthesize(text: string, accent: Accent = 'uk'): Promise<Buffer | null> {
  if (!isTtsConfigured()) return null
  const name = voice(accent)
  const id = createHash('sha256').update(`${name}\n${text}`).digest('hex')

  const [cached] = await db.select({ audio: ttsAudio.audio }).from(ttsAudio).where(eq(ttsAudio.id, id))
  if (cached) return Buffer.from(cached.audio, 'base64')

  const ssml = `<speak version="1.0" xml:lang="${name.slice(0, 5)}"><voice name="${name}">${escapeXml(text)}</voice></speak>`
  const res = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY as string,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'zichen-pte',
    },
    body: ssml,
  })
  if (!res.ok) {
    throw new Error(`Azure TTS failed: ${res.status} ${await res.text()}`)
  }
  const audio = Buffer.from(await res.arrayBuffer())
  await db
    .insert(ttsAudio)
    .values({ id, voice: name, text, audio: audio.toString('base64') })
    .onConflictDoNothing()
  return audio
}
