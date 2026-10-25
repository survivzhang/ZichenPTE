// Splitting dictionary IPA into phonemes, to label Azure's per-phoneme scores.
// Azure names phonemes only for en-US; for en-GB it returns scores in order
// without names, so the dictionary's British transcription is split and used
// as labels when the counts match.

// Multi-character phonemes, longest first. Length marks are part of the vowel.
const CLUSTERS = ['tʃ', 'dʒ', 'eɪ', 'aɪ', 'ɔɪ', 'aʊ', 'əʊ', 'oʊ', 'ɪə', 'eə', 'ʊə', 'ɛə', 'ɜː', 'ɑː', 'ɔː', 'iː', 'uː', 'ɪr', 'ɛr', 'ʊr']

// Stress marks, syllable dots, spaces and brackets carry no phoneme of their own.
const IGNORED = /[ˈˌ'ˑ.\s()[\]/,·-]/g

// length marks and the combining marks for syllabic / nasalized
const ATTACHED = new Set(['ː', 'ˑ', '\u0329', '\u0303'])
const isAttached = (ch: string) => ATTACHED.has(ch)

/** "ˈkɒɡnɪtɪv" -> ["k", "ɒ", "ɡ", "n", "ɪ", "t", "ɪ", "v"] */
export function splitIpa(ipa: string): string[] {
  const text = ipa.replace(IGNORED, '')
  const phonemes: string[] = []
  let i = 0
  while (i < text.length) {
    const cluster = CLUSTERS.find((c) => text.startsWith(c, i))
    if (cluster) {
      phonemes.push(cluster)
      i += cluster.length
      continue
    }
    let phoneme = text[i]
    i++
    // a length mark or a combining diacritic belongs to the symbol before it
    while (i < text.length && isAttached(text[i])) {
      phoneme += text[i]
      i++
    }
    phonemes.push(phoneme)
  }
  return phonemes
}

export type ScoredPhoneme = { phoneme: string | null; score: number }

/**
 * Give unnamed phoneme scores the dictionary's symbols when the counts agree.
 * Azure's en-GB model and the dictionary don't always split a word the same
 * way; when they disagree the scores stay unlabeled rather than mislabeled.
 */
export function labelPhonemes(scores: ScoredPhoneme[], ipa: string | undefined): ScoredPhoneme[] {
  if (scores.every((s) => s.phoneme)) return scores
  if (!ipa) return scores
  const symbols = splitIpa(ipa)
  if (symbols.length !== scores.length) return scores
  return scores.map((s, i) => ({ ...s, phoneme: s.phoneme ?? symbols[i] }))
}
