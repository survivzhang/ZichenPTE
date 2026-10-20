import logo from '@/assets/logo.svg'
import Tooltip from '@/components/Tooltip'
import { authClient } from '@/utils/auth-client'
import { useDueReviews } from '@/utils/review'
import { NavLink, useNavigate } from 'react-router-dom'
import IconLogout from '~icons/tabler/logout'
import IconUsers from '~icons/tabler/users'

const links = [
  { to: '/', label: 'PTE', end: true },
  { to: '/gallery', label: '其他词典' },
  { to: '/error-book', label: '错题本', showDue: true },
  { to: '/analysis', label: '统计' },
]

const iconButtonClass =
  'flex items-center justify-center rounded p-[2px] text-lg text-indigo-500 outline-none transition-colors duration-300 ease-in-out hover:bg-indigo-400 hover:text-white'

/** Top navigation for the app's main pages (the practice page keeps its own toolbar). */
export default function AppNav() {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const { count: dueCount } = useDueReviews()

  return (
    <header className="container z-20 mx-auto flex w-full items-center justify-between px-10 py-6">
      <div className="flex items-center gap-8">
        <NavLink to="/" className="flex items-center text-2xl font-bold text-indigo-500 no-underline hover:no-underline">
          <img src={logo} className="mr-3 h-12 w-12" alt="Qwerty Learner Logo" />
          <span className="hidden whitespace-nowrap xl:inline">Qwerty Learner</span>
        </NavLink>
        <nav className="flex items-center gap-1">
          {links.map(({ to, label, end, showDue }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative whitespace-nowrap rounded-lg px-4 py-2 text-base font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-500 text-white'
                    : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-500 dark:text-gray-300 dark:hover:bg-gray-800'
                }`
              }
            >
              {label}
              {showDue && !!dueCount && (
                <span className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full bg-red-500 px-1 text-center text-xs leading-5 text-white">
                  {dueCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3 rounded-xl bg-white p-3 dark:bg-gray-800">
        {session?.user.role === 'admin' && (
          <Tooltip content="用户管理">
            <button type="button" aria-label="用户管理" className={iconButtonClass} onClick={() => navigate('/admin')}>
              <IconUsers className="icon" />
            </button>
          </Tooltip>
        )}
        <Tooltip content="退出登录">
          <button type="button" aria-label="退出登录" className={iconButtonClass} onClick={() => authClient.signOut()}>
            <IconLogout className="icon" />
          </button>
        </Tooltip>
      </div>
    </header>
  )
}
