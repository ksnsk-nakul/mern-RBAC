import { useAuthStore } from '@/stores/authStore'

export function usePermission() {
  const permissions = useAuthStore((s) => s.permissions)

  function hasPermission(slug: string): boolean {
    if (permissions.includes('*')) return true
    return permissions.includes(slug)
  }

  return { hasPermission }
}
