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
  { label: 'Security',       to: '/dashboard/security' },
  { label: 'Organizations', to: '/dashboard/organizations' },
  { label: 'My Requests', to: '/dashboard/approvals' },
  { label: 'My Tickets', to: '/dashboard/tickets' },
]

const adminNav: NavItem[] = [
  { label: 'Dashboard',     to: '/admin' },
  { label: 'Users',         to: '/admin/users',                permission: 'users.view' },
  { label: 'Roles',         to: '/admin/roles',                permission: 'roles.manage' },
  { label: 'Permissions',   to: '/admin/permissions',          permission: 'permissions.view' },
  { label: 'Activity Logs', to: '/admin/logs',                 permission: 'logs.view' },
  { label: 'Support',       to: '/admin/tickets',              permission: 'tickets.view' },
  { label: 'Settings',      to: '/admin/settings',             permission: 'settings.view' },
  { label: 'Login Pages',   to: '/admin/settings/login-pages', permission: 'settings.manage' },
  { label: 'Secrets',       to: '/admin/settings/secrets' },
  { label: 'Security',       to: '/admin/security',         permission: 'roles.manage' },
  { label: 'Organizations', to: '/admin/organizations',    permission: 'orgs.view' },
  { label: 'Plans',     to: '/admin/billing/plans', permission: 'billing.view' },
  { label: 'Products',  to: '/admin/products',      permission: 'billing.view' },
  { label: 'Approvals', to: '/admin/approvals',     permission: 'approvals.manage' },
]

const subadminNav: NavItem[] = [
  { label: 'Dashboard', to: '/subadmin' },
  { label: 'Users',     to: '/subadmin/users' },
  { label: 'Activity',  to: '/subadmin/activity' },
  { label: 'Support',   to: '/subadmin/tickets' },
]

export function Sidebar() {
  const { role, user } = useAuthStore()
  const { hasPermission } = usePermission()

  const nav =
    role?.route === 'admin'    ? adminNav    :
    role?.route === 'subadmin' ? subadminNav :
    userNav

  const filtered = nav.filter((item) => !item.permission || hasPermission(item.permission))

  return (
    <aside className="flex w-56 flex-col border-r bg-card">
      <div
        className="flex h-14 shrink-0 flex-col items-start justify-center px-4 text-white"
        style={{ backgroundColor: 'var(--role-accent)' }}
      >
        <span className="text-lg font-bold leading-tight">{role?.name ?? 'App'}</span>
        {user?.currentOrg && (
          <span className="text-xs text-white/70 truncate max-w-[176px]">{user.currentOrg.name}</span>
        )}
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
