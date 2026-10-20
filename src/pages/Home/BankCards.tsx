import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useStartBankChapter } from '@/hooks/useStartReview'
import { bankChapterTitle, useBank } from '@/utils/review'
import IconCheckCircle from '~icons/heroicons/check-circle-solid'
import IconLock from '~icons/tabler/lock'

const BANKS = [
  { type: 'fib', name: 'FIB 固定搭配', unit: '条', hint: '只拼空里的搭配词' },
  { type: 'wfd', name: 'WFD 拼写', unit: '句', hint: '听整句，默写整句' },
] as const

/**
 * The user's own FIB / WFD question bank (imported via the API), shown like a
 * word book: chapters by import date, practiced in order.
 */
function BankCard({ type, name, unit, hint, isLocked }: (typeof BANKS)[number] & { isLocked: boolean }) {
  const chapters = useBank(type)
  const startBankChapter = useStartBankChapter()
  const itemCount = chapters?.reduce((sum, chapter) => sum + chapter.items.length, 0)
  const doneCount = chapters?.filter((chapter) => chapter.completed).length ?? 0
  const progress = chapters?.length ? Math.round((doneCount / chapters.length) * 100) : 0

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div
          role="button"
          className="group flex h-36 w-80 cursor-pointer flex-col justify-between overflow-hidden rounded-lg border-2 border-dashed border-indigo-200 bg-white p-5 text-left shadow-lg hover:border-indigo-400 dark:border-gray-600 dark:bg-gray-800"
        >
          <div>
            <h1 className="text-xl font-normal text-gray-800 group-hover:text-indigo-500 dark:text-gray-200">{name}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">我的题库 · {hint}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-600 dark:text-gray-300">
              {itemCount ?? '…'} {unit} · {chapters?.length ?? '…'} 组
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-indigo-50 dark:bg-gray-700">
              <div className="h-full rounded-full bg-indigo-400" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </DialogTrigger>
      <DialogContent className="w-[48rem] max-w-none !rounded-[20px]">
        <DialogTitle className="text-2xl">{name}</DialogTitle>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          按导入日期分组；第一遍打错的会进入「练习中错题」，按 FSRS 建议复习（不强制）。
        </p>
        {isLocked && (
          <p className="flex items-center text-sm text-amber-600">
            <IconLock className="mr-1 h-4 w-4" />
            先完成今天的单词复习，才能开始新的一组。
          </p>
        )}
        <div className="mt-2 grid max-h-[28rem] grid-cols-3 gap-3 overflow-y-auto pr-1">
          {chapters?.length === 0 && <p className="col-span-3 py-8 text-center text-gray-400">还没有导入题目，见 docs/API.md</p>}
          {chapters?.map((chapter) => (
            <button
              key={chapter.index}
              type="button"
              disabled={isLocked}
              onClick={() => startBankChapter(type, chapter)}
              className="relative rounded-xl bg-slate-100 px-4 py-3 text-left transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              <div className="font-medium text-gray-800 dark:text-gray-100">{bankChapterTitle(chapter)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {chapter.items.length} {unit}
                {chapter.completed ? ' · 已练' : ''}
              </div>
              {chapter.completed && <IconCheckCircle className="absolute right-3 top-3 h-5 w-5 text-green-500" />}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function BankCards({ isLocked }: { isLocked: boolean }) {
  return (
    <>
      {BANKS.map((bank) => (
        <BankCard key={bank.type} {...bank} isLocked={isLocked} />
      ))}
    </>
  )
}
