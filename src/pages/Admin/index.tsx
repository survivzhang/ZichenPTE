import Layout from '@/components/Layout'
import useGoBack from '@/hooks/useGoBack'
import { authClient } from '@/utils/auth-client'
import type { FormEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import IconX from '~icons/tabler/x'

type Role = 'user' | 'admin'

type AdminUser = {
  id: string
  name: string
  username?: string | null
  displayUsername?: string | null
  role?: string | null
  createdAt: Date | string
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_.]{3,30}$/

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:ring-indigo-900'

const primaryButtonClass =
  'rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-70'

const smallButtonClass = 'rounded-md px-2.5 py-1 text-sm transition disabled:cursor-not-allowed disabled:opacity-60'

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('user')
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const displayUsername = username.trim()
    if (!USERNAME_PATTERN.test(displayUsername)) {
      setMessage({ type: 'error', text: '用户名需为 3-30 位字母、数字、下划线或点' })
      return
    }
    if (password.length < 8) {
      setMessage({ type: 'error', text: '密码至少 8 位' })
      return
    }

    setIsSubmitting(true)
    setMessage(null)
    // Usernames are matched case-insensitively at sign-in, so store them lowercased.
    const normalized = displayUsername.toLowerCase()
    const { error } = await authClient.admin.createUser({
      // Better Auth requires an email; this app signs in by username only.
      email: `${normalized}@qwerty.local`,
      name: displayUsername,
      password,
      role,
      data: { username: normalized, displayUsername },
    })
    setIsSubmitting(false)

    if (error) {
      setMessage({ type: 'error', text: error.code === 'USER_ALREADY_EXISTS' ? '该用户名已存在' : error.message || '创建失败' })
      return
    }
    setMessage({ type: 'success', text: `已创建用户 ${displayUsername}` })
    setUsername('')
    setPassword('')
    setRole('user')
    onCreated()
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-100">新建用户</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">用户名</span>
          <input
            type="text"
            autoComplete="off"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">初始密码</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">角色</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </select>
        </label>
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting ? '创建中…' : '创建'}
        </button>
      </div>
      {message && (
        <p role="alert" className={`mt-3 text-sm ${message.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
          {message.text}
        </p>
      )}
    </form>
  )
}

function UserRow({ user, isSelf, onChanged }: { user: AdminUser; isSelf: boolean; onChanged: () => void }) {
  const [mode, setMode] = useState<'idle' | 'password' | 'confirmDelete'>('idle')
  const [newPassword, setNewPassword] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  const resetPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      setStatus('密码至少 8 位')
      return
    }
    setIsBusy(true)
    const { error } = await authClient.admin.setUserPassword({ userId: user.id, newPassword })
    setIsBusy(false)
    setStatus(error ? error.message || '修改失败' : '密码已更新')
    if (!error) {
      setNewPassword('')
      setMode('idle')
    }
  }

  const removeUser = async () => {
    setIsBusy(true)
    const { error } = await authClient.admin.removeUser({ userId: user.id })
    setIsBusy(false)
    if (error) {
      setStatus(error.message || '删除失败')
      setMode('idle')
      return
    }
    onChanged()
  }

  return (
    <tr className="border-t border-gray-100 align-top dark:border-gray-700">
      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">
        {user.displayUsername || user.username || user.name}
        {isSelf && <span className="ml-2 text-xs text-gray-400">（你）</span>}
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            user.role === 'admin'
              ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-200'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
          }`}
        >
          {user.role === 'admin' ? '管理员' : '普通用户'}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{new Date(user.createdAt).toLocaleDateString()}</td>
      <td className="px-4 py-3">
        {mode === 'password' ? (
          <form onSubmit={resetPassword} className="flex items-center gap-2">
            <input
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="新密码"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={`${inputClass} !py-1 text-sm`}
            />
            <button type="submit" disabled={isBusy} className={`${smallButtonClass} bg-indigo-500 text-white hover:bg-indigo-600`}>
              保存
            </button>
            <button type="button" onClick={() => setMode('idle')} className={`${smallButtonClass} text-gray-500 hover:bg-gray-100`}>
              取消
            </button>
          </form>
        ) : mode === 'confirmDelete' ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-red-500">删除该用户及其全部记录？</span>
            <button
              type="button"
              disabled={isBusy}
              onClick={removeUser}
              className={`${smallButtonClass} bg-red-500 text-white hover:bg-red-600`}
            >
              确认删除
            </button>
            <button type="button" onClick={() => setMode('idle')} className={`${smallButtonClass} text-gray-500 hover:bg-gray-100`}>
              取消
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setStatus(null)
                setMode('password')
              }}
              className={`${smallButtonClass} text-indigo-500 hover:bg-indigo-50 dark:hover:bg-gray-700`}
            >
              重置密码
            </button>
            {!isSelf && (
              <button
                type="button"
                onClick={() => {
                  setStatus(null)
                  setMode('confirmDelete')
                }}
                className={`${smallButtonClass} text-red-500 hover:bg-red-50 dark:hover:bg-gray-700`}
              >
                删除
              </button>
            )}
          </div>
        )}
        {status && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{status}</p>}
      </td>
    </tr>
  )
}

export default function AdminPage() {
  const { data: session } = authClient.useSession()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    const { data, error } = await authClient.admin.listUsers({ query: { limit: 200, sortBy: 'createdAt', sortDirection: 'asc' } })
    if (error) {
      setLoadError(error.message || '加载用户失败')
      return
    }
    setLoadError(null)
    setUsers(data.users as AdminUser[])
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const onBack = useGoBack()
  useHotkeys('esc', onBack, { preventDefault: true })

  return (
    <Layout>
      <div className="relative flex w-full flex-1 flex-col items-center overflow-y-auto px-6 pt-20">
        <IconX className="absolute right-20 top-10 mr-2 h-7 w-7 cursor-pointer text-gray-400" onClick={onBack} />
        <div className="w-full max-w-4xl space-y-6 pb-10">
          <div>
            <h1 className="text-2xl font-bold text-indigo-500">用户管理</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">应用不开放注册，所有账号都由管理员在这里创建。</p>
          </div>

          <CreateUserForm onCreated={loadUsers} />

          <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-gray-800">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">用户名</th>
                  <th className="px-4 py-3 font-medium">角色</th>
                  <th className="px-4 py-3 font-medium">创建时间</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <UserRow key={user.id} user={user} isSelf={user.id === session?.user.id} onChanged={loadUsers} />
                ))}
              </tbody>
            </table>
            {loadError && <p className="px-4 py-3 text-sm text-red-500">{loadError}</p>}
          </div>
        </div>
      </div>
    </Layout>
  )
}
