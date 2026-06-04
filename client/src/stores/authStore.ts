import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthUser {
  id: string
  name: string
  email: string
  avatarUrl?: string
  isFounder: boolean
}

interface AuthRole {
  name: string
  slug: string
  route: string
  color: string
}

interface AuthState {
  user:            AuthUser | null
  role:            AuthRole | null
  permissions:     string[]
  isAuthenticated: boolean
  setAuth:   (user: AuthUser, role: AuthRole, permissions: string[]) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:            null,
      role:            null,
      permissions:     [],
      isAuthenticated: false,

      setAuth: (user, role, permissions) =>
        set({ user, role, permissions, isAuthenticated: true }),

      clearAuth: () =>
        set({ user: null, role: null, permissions: [], isAuthenticated: false }),
    }),
    {
      name:        'auth',
      partialize:  (s) => ({
        user:            s.user,
        role:            s.role,
        permissions:     s.permissions,
        isAuthenticated: s.isAuthenticated,
      }),
    },
  ),
)
