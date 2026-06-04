import { NavLink } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { usePermission } from '@/hooks/usePermission'
import { cn } from '@/lib/utils'

interface NavItem {
  label:      string
  to:         string
  permission?: string
}

const userNav: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Planner',   to: '/dashboard/planner' },
  { label: 'Projects',  to: '/dashboard/projects' },
  { label: 'Tasks',     to: '/dashboard/tasks' },
  { label: 'AI Assistant', to: '/dashboard/ai' },
]

const adminNav: NavItem[] = [
  { label: 'Dashboard',     to: '/admin' },
  { label: 'Users',         to: '/admin/users',       permission: 'users.view' },
  { label: 'Roles',         to: '/admin/roles',       permission: 'roles.manage' },
  { label: 'Permissions',   to: '/admin/permissions', permission: 'permissions.view' },
  { label: 'Activity Logs', to: '/admin/logs',        permission: 'logs.view' },
  { label: 'Support',       to: '/admin/tickets',     permission: 'tickets.view' },
  { label: 'Settings',      to: '/admin/settings',    permission: 'settings.view' },
]

const subadminNav: NavItem[] = [
  { label: 'Dashboard', to: '/subadmin' },
  { label: 'Users',     to: '/subadmin/users' },
  { label: 'Activity',  to: '/subadmin/activity' },
  { label: 'Support',   to: '/subadmin/tickets' },
]

export function Sidebar() {
  const { role } = useAuthStore()
  const { hasPermission } = usePermission()

  const nav =
    role?.route === 'admin'    ? adminNav    :
    role?.route === 'subadmin' ? subadminNav :
    userNav

  const filtered = nav.filter((item) => !item.permission || hasPermission(item.permission))

  return (
    <aside className="flex w-56 flex-col border-r bg-card">
      <div
        className="flex h-14 shrink-0 items-center px-4 text-lg font-bold text-white"
        style={{ backgroundColor: 'var(--role-accent)' }}
      >
        {role?.name ?? 'App'}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2 pt-4">
        {filtered.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              cn(
                'block rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'font-medium text-white'
                  : 'text-foreground hover:bg-accent',
              )
            }
            style={({ isActive }) =>
              isActive ? { backgroundColor: 'var(--role-accent)' } : {}
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
