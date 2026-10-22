import logo from '@/assets/logo.svg'
import { authClient } from '@/utils/auth-client'
import type { FormEvent } from 'react'
import { useState } from 'react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const { error } = await authClient.signIn.username({ username: username.trim(), password, rememberMe: true })
    setIsSubmitting(false)
    if (error) {
      setError(error.status === 429 ? '尝试次数太多，请一分钟后再试' : '用户名或密码错误')
    }
    // On success the session hook updates and the app renders in place of this page.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-indigo-50/40 px-4 dark:bg-gray-900">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg shadow-indigo-100 dark:bg-gray-800 dark:shadow-none"
      >
        <div className="mb-8 flex flex-col items-center">
          <img src={logo} className="h-16 w-16" alt="Zichen-PTE Logo" />
          <h1 className="mt-3 text-2xl font-bold text-indigo-500">Zichen-PTE</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">登录后开始练习</p>
        </div>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">用户名</span>
          <input
            type="text"
            name="username"
            autoComplete="username"
            autoFocus
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:ring-indigo-900"
          />
        </label>

        <label className="mb-6 block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">密码</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:ring-indigo-900"
          />
        </label>

        {error && (
          <p role="alert" className="-mt-2 mb-4 text-sm text-red-500">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center rounded-lg bg-indigo-500 px-4 py-2.5 font-medium text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? '登录中…' : '登录'}
        </button>
      </form>
    </div>
  )
}
