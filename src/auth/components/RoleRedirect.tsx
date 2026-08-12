import { Navigate } from 'react-router-dom'
import { LoadingState } from '../../shared/components/LoadingState'
import { AuthErrorState } from './AuthErrorState'
import { useAuth } from '../useAuth'

export function RoleRedirect() {
  const { session, profile, loading, issue } = useAuth()
  if (loading) return <LoadingState label="Loading your account" />
  if (!session) return <Navigate to="/login" replace />
  if (issue || !profile) return <AuthErrorState message={issue?.message ?? 'No profile is connected to this account.'} />
  if (profile.status !== 'ACTIVE') return <AuthErrorState message="Your account is inactive. Contact an administrator." />
  return <Navigate to={profile.role === 'ADMIN' ? '/admin' : '/sales'} replace />
}
