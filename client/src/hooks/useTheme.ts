import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'

export function useTheme() {
  const role = useAuthStore((s) => s.role)

  useEffect(() => {
    const color = role?.color ?? '#6366f1'
    document.documentElement.style.setProperty('--role-accent', color)
  }, [role?.color])
}
