import Tooltip from '@/components/Tooltip'
import { speakConfigAtom } from '@/store'
import type { SpeakLocale } from '@/store'
import { useAtom } from 'jotai'

const OPTIONS: { locale: SpeakLocale; label: string; hint: string }[] = [
  { locale: 'en-GB', label: '英音', hint: '按英音打分；音素只有分数，用词典音标对位' },
  { locale: 'en-US', label: '美音', hint: '按美音打分；能标出具体读错的音素和你读成了什么' },
]

/** Which accent the speaking track is scored against; phonetics and the dictionary audio follow it. */
export default function SpeakLocaleSwitcher() {
  const [config, setConfig] = useAtom(speakConfigAtom)
  return (
    <div className="flex items-center rounded-lg bg-indigo-50 p-0.5 dark:bg-gray-700">
      {OPTIONS.map(({ locale, label, hint }) => (
        <Tooltip key={locale} content={hint}>
          <button
            type="button"
            onClick={(e) => {
              setConfig((old) => ({ ...old, locale }))
              e.currentTarget.blur()
            }}
            className={`rounded-md px-3 py-1 text-sm transition-colors ${
              config.locale === locale ? 'bg-indigo-500 text-white' : 'text-gray-600 hover:text-indigo-500 dark:text-gray-300'
            }`}
          >
            {label}
          </button>
        </Tooltip>
      ))}
    </div>
  )
}
