import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { usePermission } from '@/hooks/usePermission'

interface Props {
  children:    ReactNode
  permission?: string
  roleRoute?:  string
}

export function AuthGuard({ children, permission, roleRoute }: Props) {
  const { isAuthenticated, role } = useAuthStore()
  const { hasPermission } = usePermission()

  if (!isAuthenticated) {
    return <Navigate to={`/login/${roleRoute ?? 'user'}`} replace />
  }

  if (roleRoute && role?.route !== roleRoute) {
    return <Navigate to={`/${role?.route ?? 'user'}`} replace />
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div className="flex h-screen items-center justify-center text-destructive">
        Access denied — missing permission: {permission}
      </div>
    )
  }

  return <>{children}</>
}
