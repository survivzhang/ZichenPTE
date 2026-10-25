import { useStartSession } from '@/hooks/useStartReview'
import type { SessionType } from '@/store'
import { fetchAllCards, useDueReviews } from '@/utils/review'
import { useNavigate } from 'react-router-dom'
import useSWR from 'swr'
import IconArrowRight from '~icons/tabler/arrow-right'

const SECTIONS: { type: Exclude<SessionType, 'word'>; title: string; description: string; unit: string }[] = [
  {
    type: 'fib',
    title: 'FIB 固定搭配错题',
    description: '练 FIB 题库时第一遍打错的搭配。按 FSRS 建议复习，不强制。',
    unit: '句',
  },
  {
    type: 'wfd',
    title: 'WFD 拼写错题',
    description: '练 WFD 题库时第一遍打错的句子。按 FSRS 建议复习，不强制。',
    unit: '句',
  },
]

function useCards(type: SessionType) {
  const { data } = useSWR(`review-cards-${type}`, () => fetchAllCards(type))
  return data?.cards
}

function SectionCard({ type, title, description, unit }: (typeof SECTIONS)[number]) {
  const cards = useCards(type)
  const { count: dueCount } = useDueReviews(type)
  const startSession = useStartSession()
  const navigate = useNavigate()
  const total = cards?.length

  return (
    <section className="flex flex-col rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
      <h3 className="text-xl font-semibold text-indigo-500">{title}</h3>
      <p className="mt-2 flex-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      <p className="mt-4 text-gray-700 dark:text-gray-200">
        共 {total ?? '…'} {unit}
        {!!dueCount && (
          <span className="ml-2 text-sm text-amber-600">
            · 建议今天复习 {dueCount} {unit}
          </span>
        )}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!dueCount}
          onClick={() => startSession(type, 'review')}
          className="inline-flex items-center rounded-xl bg-indigo-500 px-4 py-2 font-medium text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-600"
        >
          复习到期的 {dueCount ?? 0} {unit}
          <IconArrowRight className="ml-1.5 h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={!total}
          onClick={() => startSession(type, 'learn')}
          className="rounded-xl bg-indigo-50 px-4 py-2 font-medium text-indigo-600 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-indigo-300"
        >
          全部练习
        </button>
        <button
          type="button"
          onClick={() => navigate(`/error-book?type=${type}`)}
          className="rounded-xl px-3 py-2 text-sm text-gray-500 hover:text-indigo-500 dark:text-gray-400"
        >
          查看列表
        </button>
      </div>
    </section>
  )
}

function SpeakErrorsCard() {
  const cards = useCards('speak')
  const startSession = useStartSession()
  const navigate = useNavigate()
  return (
    <section className="flex flex-col rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
      <h3 className="text-xl font-semibold text-indigo-500">错音库</h3>
      <p className="mt-2 flex-1 text-sm text-gray-500 dark:text-gray-400">
        跟读时第一遍没及格的词。到期的在上面「错音复习」里，这里可以随时全部再读一遍。
      </p>
      <p className="mt-4 text-gray-700 dark:text-gray-200">共 {cards?.length ?? '…'} 词</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!cards?.length}
          onClick={() => startSession('speak', 'learn')}
          className="rounded-xl bg-indigo-50 px-4 py-2 font-medium text-indigo-600 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-indigo-300"
        >
          全部跟读
        </button>
        <button
          type="button"
          onClick={() => navigate('/error-book?type=speak')}
          className="rounded-xl px-3 py-2 text-sm text-gray-500 hover:text-indigo-500 dark:text-gray-400"
        >
          查看列表
        </button>
      </div>
    </section>
  )
}

function ErrorWordsCard() {
  const cards = useCards('word')
  const navigate = useNavigate()
  // Words imported from PTE practice (anything not missed while typing a word book).
  const imported = cards?.filter((card) => card.source !== 'typing')

  return (
    <section className="flex flex-col rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
      <h3 className="text-xl font-semibold text-indigo-500">错词词典</h3>
      <p className="mt-2 flex-1 text-sm text-gray-500 dark:text-gray-400">
        做 PTE 题时错的单词（通过 API 导入），和打字时拼错的词一起进入每日复习。
      </p>
      <p className="mt-4 text-gray-700 dark:text-gray-200">共 {imported?.length ?? '…'} 词</p>
      <div className="mt-4">
        <button
          type="button"
          onClick={() => navigate('/error-book?type=word')}
          className="rounded-xl bg-indigo-50 px-4 py-2 font-medium text-indigo-600 transition hover:bg-indigo-100 dark:bg-gray-700 dark:text-indigo-300"
        >
          查看列表
        </button>
      </div>
    </section>
  )
}

/** PTE 练习中错题: FIB and WFD are optional practice with their own FSRS schedule; error words join the daily review. */
export default function PracticeMistakes() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
      {SECTIONS.map((section) => (
        <SectionCard key={section.type} {...section} />
      ))}
      <ErrorWordsCard />
      <SpeakErrorsCard />
    </div>
  )
}
