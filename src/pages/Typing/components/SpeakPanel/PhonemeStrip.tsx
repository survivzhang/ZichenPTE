import type { ScoredPhoneme } from '@/utils/speech/ipa'

const colorFor = (score: number) =>
  score >= 80
    ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-200'
    : score >= 60
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200'
    : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200'

/**
 * One block per phoneme, in order, colored by its score. The symbol is shown
 * when Azure named it (en-US) or the dictionary's transcription could be
 * matched up; otherwise the block only marks the position.
 */
export default function PhonemeStrip({ phonemes }: { phonemes: (ScoredPhoneme & { spoken?: string })[] }) {
  if (phonemes.length === 0) return null
  return (
    <div className="flex flex-wrap items-end justify-center gap-1.5">
      {phonemes.map((p, i) => (
        <div key={i} className={`flex min-w-[2.25rem] flex-col items-center rounded-md px-1.5 py-1 font-mono ${colorFor(p.score)}`}>
          <span className="text-base leading-5">{p.phoneme ?? '·'}</span>
          <span className="text-[11px] leading-4 opacity-80">{p.score}</span>
          {p.spoken && p.spoken !== p.phoneme && p.score < 80 && (
            <span className="text-[10px] leading-4 opacity-70" title="你读成了">
              →{p.spoken}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
