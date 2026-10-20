import logo from '@/assets/logo.svg'
import Tooltip from '@/components/Tooltip'
import { authClient } from '@/utils/auth-client'
import type { PropsWithChildren } from 'react'
import type React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import IconLogout from '~icons/tabler/logout'
import IconUsers from '~icons/tabler/users'

const Header: React.FC<PropsWithChildren> = ({ children }) => {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const isAdmin = session?.user.role === 'admin'

  return (
    <header className="container z-20 mx-auto w-full px-10 py-6">
      <div className="flex w-full flex-col items-center justify-between space-y-3 lg:flex-row lg:space-y-0">
        <NavLink
          className="flex items-center text-2xl font-bold text-indigo-500 no-underline hover:no-underline lg:text-4xl"
          to="https://qwerty.kaiyi.cool/"
        >
          <img src={logo} className="mr-3 h-16 w-16" alt="Qwerty Learner Logo" />
          <h1>Qwerty Learner</h1>
        </NavLink>
        <nav className="my-card on element flex w-auto content-center items-center justify-end space-x-3 rounded-xl bg-white p-4 transition-colors duration-300 dark:bg-gray-800">
          {children}
          {isAdmin && (
            <Tooltip content="用户管理">
              <button
                type="button"
                aria-label="用户管理"
                className="flex items-center justify-center rounded p-[2px] text-lg text-indigo-500 outline-none transition-colors duration-300 ease-in-out hover:bg-indigo-400 hover:text-white"
                onClick={() => navigate('/admin')}
              >
                <IconUsers className="icon" />
              </button>
            </Tooltip>
          )}
          <Tooltip content="退出登录">
            <button
              type="button"
              aria-label="退出登录"
              className="flex items-center justify-center rounded p-[2px] text-lg text-indigo-500 outline-none transition-colors duration-300 ease-in-out hover:bg-indigo-400 hover:text-white"
              onClick={() => authClient.signOut()}
            >
              <IconLogout className="icon" />
            </button>
          </Tooltip>
        </nav>
      </div>
    </header>
  )
}

export default Header
