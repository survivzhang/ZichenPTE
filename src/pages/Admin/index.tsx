import AppNav from '@/components/AppNav'
import Layout from '@/components/Layout'
import useGoBack from '@/hooks/useGoBack'
import { deleteJSON, getJSON, postJSON } from '@/utils/api'
import { authClient } from '@/utils/auth-client'
import type { FormEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

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

type ApiKeyRow = { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null }

/** Keys for the /api/v1 import API (see docs/API.md). The full key is shown only once, right after creation. */
function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([])
  const [name, setName] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null)

  const loadKeys = useCallback(async () => {
    const data = await getJSON<{ keys: ApiKeyRow[] }>('/api-keys')
    if (data) setKeys(data.keys)
  }, [])

  useEffect(() => {
    loadKeys()
  }, [loadKeys])

  const createKey = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const created = await postJSON<{ key: string }>('/api-keys', { name: name.trim() })
    if (created) {
      setNewKey(created.key)
      setCopied(false)
      setName('')
      loadKeys()
    }
  }

  const revokeKey = async (id: string) => {
    await deleteJSON(`/api-keys/${id}`)
    setConfirmRevokeId(null)
    loadKeys()
  }

  const copyKey = async () => {
    if (!newKey) return
    try {
      await navigator.clipboard.writeText(newKey)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">API 密钥</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        用于脚本或 Claude 通过 /api/v1 导入错词（用法见仓库里的 docs/API.md）。密钥拥有管理员权限，请妥善保管。
      </p>

      <form onSubmit={createKey} className="mt-4 flex gap-3">
        <input
          type="text"
          placeholder="密钥名称，例如：Claude 导入"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        <button type="submit" className={`${primaryButtonClass} whitespace-nowrap`}>
          生成密钥
        </button>
      </form>

      {newKey && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/30">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">这是唯一一次显示完整密钥，请现在复制保存：</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-white px-3 py-2 font-mono text-sm text-gray-800 dark:bg-gray-900 dark:text-gray-100">
              {newKey}
            </code>
            <button type="button" onClick={copyKey} className={`${smallButtonClass} bg-amber-500 text-white hover:bg-amber-600`}>
              {copied ? '已复制' : '复制'}
            </button>
          </div>
          <button type="button" onClick={() => setNewKey(null)} className="mt-2 text-xs text-amber-700 hover:underline dark:text-amber-300">
            我已保存，隐藏
          </button>
        </div>
      )}

      {keys.length > 0 && (
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-gray-500 dark:text-gray-400">
            <tr>
              <th className="py-2 font-medium">名称</th>
              <th className="py-2 font-medium">密钥</th>
              <th className="py-2 font-medium">创建时间</th>
              <th className="py-2 font-medium">最近使用</th>
              <th className="py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="py-2 text-gray-800 dark:text-gray-100">{key.name}</td>
                <td className="py-2 font-mono text-gray-500">{key.prefix}…</td>
                <td className="py-2 text-gray-500">{new Date(key.createdAt).toLocaleDateString()}</td>
                <td className="py-2 text-gray-500">{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : '从未'}</td>
                <td className="py-2">
                  {confirmRevokeId === key.id ? (
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => revokeKey(key.id)}
                        className={`${smallButtonClass} bg-red-500 text-white hover:bg-red-600`}
                      >
                        确认吊销
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRevokeId(null)}
                        className={`${smallButtonClass} text-gray-500 hover:bg-gray-100`}
                      >
                        取消
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmRevokeId(key.id)}
                      className={`${smallButtonClass} text-red-500 hover:bg-red-50 dark:hover:bg-gray-700`}
                    >
                      吊销
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
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
      <AppNav />
      <div className="relative flex w-full flex-1 flex-col items-center overflow-y-auto px-6">
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

          <ApiKeysSection />
        </div>
      </div>
    </Layout>
  )
}
