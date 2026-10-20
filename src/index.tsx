import Loading from './components/Loading'
import PreferencesSync from './components/PreferencesSync'
import './index.css'
import { ErrorBook } from './pages/ErrorBook'
import { FriendLinks } from './pages/FriendLinks'
import HomePage from './pages/Home'
import MobilePage from './pages/Mobile'
import TypingPage from './pages/Typing'
import { authClient } from './utils/auth-client'
import { isOpenDarkModeAtom } from '@/store'
import 'animate.css'
import { useAtomValue } from 'jotai'
import React, { Suspense, lazy, useEffect, useState } from 'react'
import 'react-app-polyfill/stable'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

const AnalysisPage = lazy(() => import('./pages/Analysis'))
const GalleryPage = lazy(() => import('./pages/Gallery-N'))
const LoginPage = lazy(() => import('./pages/Login'))
const AdminPage = lazy(() => import('./pages/Admin'))

function Root() {
  const darkMode = useAtomValue(isOpenDarkModeAtom)
  useEffect(() => {
    darkMode ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark')
  }, [darkMode])

  const { data: session, isPending } = authClient.useSession()
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600)

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth <= 600
      if (!isMobile) {
        window.location.href = '/'
      }
      setIsMobile(isMobile)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <React.StrictMode>
      <BrowserRouter basename={REACT_APP_DEPLOY_ENV === 'pages' ? '/qwerty-learner' : ''}>
        <Suspense fallback={<Loading />}>
          {isPending ? (
            <Loading />
          ) : !session ? (
            <LoginPage />
          ) : (
            <PreferencesSync>
              <Routes>
                {isMobile ? (
                  <Route path="/*" element={<Navigate to="/mobile" />} />
                ) : (
                  <>
                    <Route index element={<HomePage />} />
                    <Route path="/practice" element={<TypingPage />} />
                    <Route path="/gallery" element={<GalleryPage />} />
                    <Route path="/analysis" element={<AnalysisPage />} />
                    <Route path="/error-book" element={<ErrorBook />} />
                    <Route path="/friend-links" element={<FriendLinks />} />
                    {session.user.role === 'admin' && <Route path="/admin" element={<AdminPage />} />}
                    <Route path="/*" element={<Navigate to="/" />} />
                  </>
                )}
                <Route path="/mobile" element={<MobilePage />} />
              </Routes>
            </PreferencesSync>
          )}
        </Suspense>
      </BrowserRouter>
    </React.StrictMode>
  )
}

const container = document.getElementById('root')

container && createRoot(container).render(<Root />)
