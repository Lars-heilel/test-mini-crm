import { Navigate } from 'react-router'
import { useAuth } from './useAuth'

export function HomeRedirect() {
  const { profile } = useAuth()
  if (!profile) return null
  return <Navigate to={profile.role === 'manager' ? '/objects' : '/my-tasks'} replace />
}
