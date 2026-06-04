import { Outlet } from 'react-router-dom'
import { useTheme } from '@/hooks/useTheme'
import { Sidebar } from './Sidebar'

export function AppShell() {
  useTheme()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
