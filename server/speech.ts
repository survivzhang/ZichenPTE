// Short-lived tokens for the Azure Speech SDK in the browser (pronunciation
// assessment). The subscription key never leaves the server; a token is valid
// for 10 minutes, so one is reused for 9.
import { isTtsConfigured } from './tts.js'

const TOKEN_TTL_MS = 9 * 60 * 1000

let cached: { token: string; expiresAt: number } | null = null

export const isSpeechConfigured = isTtsConfigured

export async function speechToken(): Promise<{ token: string; region: string; expiresAt: number } | null> {
  if (!isSpeechConfigured()) return null
  const region = process.env.AZURE_SPEECH_REGION as string
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return { ...cached, region }
  }
  const res = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY as string, 'Content-Length': '0' },
  })
  if (!res.ok) {
    throw new Error(`Azure token failed: ${res.status} ${await res.text()}`)
  }
  cached = { token: await res.text(), expiresAt: Date.now() + TOKEN_TTL_MS }
  return { ...cached, region }
}
