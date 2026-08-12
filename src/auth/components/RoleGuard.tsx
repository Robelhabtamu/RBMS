import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { LoadingState } from '../../shared/components/LoadingState'
import { AuthErrorState } from './AuthErrorState'
import { useAuth } from '../useAuth'
import type { UserRole } from '../types'

type RoleGuardProps = {
  allowedRoles: UserRole[]
  children: ReactNode
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { session, profile, loading, issue } = useAuth()

  if (loading) return <LoadingState label="Checking access" />
  if (!session) return <Navigate to="/login" replace />
  if (issue || !profile) return <AuthErrorState message={issue?.message ?? 'No profile is connected to this account.'} />
  if (profile.status !== 'ACTIVE') return <AuthErrorState message="Your account is inactive. Contact an administrator." />
  if (!allowedRoles.includes(profile.role)) {
    return <AuthErrorState message={`Authentication succeeded, but this account has the ${profile.role} role and is not authorized for this area.`} />
  }

  return children
}
