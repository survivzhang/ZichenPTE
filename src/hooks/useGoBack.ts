import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Go back to the page the user came from (e.g. the practice page or the home
 * page), or to the home page when this page was opened directly.
 */
export default function useGoBack() {
  const navigate = useNavigate()
  return useCallback(() => {
    // react-router keeps the position in its own history stack in `idx`.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    idx > 0 ? navigate(-1) : navigate('/')
  }, [navigate])
}
