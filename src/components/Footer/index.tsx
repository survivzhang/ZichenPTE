import type React from 'react'

const Footer: React.FC = () => (
  <footer className="mb-1 mt-4 hidden w-full items-center justify-center gap-2.5 text-sm text-gray-500 dark:text-gray-400 sm:flex">
    <span>@ Zichen-PTE</span>
    <span className="select-none rounded bg-slate-200 px-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
      Build <span className="select-all">{LATEST_COMMIT_HASH}</span>
    </span>
  </footer>
)

export default Footer
