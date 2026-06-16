import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthGuard }          from './AuthGuard'
import { AppShell }           from '@/components/layout/AppShell'
import LoginPage              from '@/pages/auth/LoginPage'
import GoogleCallback         from '@/pages/auth/GoogleCallback'
import UserDashboard          from '@/pages/dashboard/UserDashboard'
import AdminDashboard         from '@/pages/admin/AdminDashboard'
import UsersPage              from '@/pages/admin/UsersPage'
import RolesPage              from '@/pages/admin/RolesPage'
import PermissionsPage        from '@/pages/admin/PermissionsPage'
import SettingsPage           from '@/pages/admin/SettingsPage'
import LoginPagesPage         from '@/pages/admin/LoginPagesPage'
import SecretsPage            from '@/pages/admin/SecretsPage'
import AdminSecurityPage      from '@/pages/admin/SecurityPage'
import ActivityLogsPage       from '@/pages/admin/ActivityLogsPage'
import AdminOrganizationsPage from '@/pages/admin/OrganizationsPage'
import SupportTicketsPage     from '@/pages/admin/SupportTicketsPage'
import SubAdminDashboard      from '@/pages/subadmin/SubAdminDashboard'
import UserSecurityPage       from '@/pages/dashboard/SecurityPage'

export function AppRouter() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login/:roleRoute"     element={<LoginPage />} />
      <Route path="/auth/google/callback" element={<GoogleCallback />} />
      <Route path="/"                     element={<Navigate to="/login/user" replace />} />

      {/* User */}
      <Route element={<AuthGuard roleRoute="dashboard"><AppShell /></AuthGuard>}>
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/dashboard/security" element={<AuthGuard><UserSecurityPage /></AuthGuard>} />
      </Route>

      {/* Admin */}
      <Route element={<AuthGuard roleRoute="admin"><AppShell /></AuthGuard>}>
        <Route path="/admin"                        element={<AdminDashboard />} />
        <Route path="/admin/users"                  element={<AuthGuard permission="users.view"><UsersPage /></AuthGuard>} />
        <Route path="/admin/roles"                  element={<AuthGuard permission="roles.manage"><RolesPage /></AuthGuard>} />
        <Route path="/admin/permissions"            element={<AuthGuard permission="permissions.view"><PermissionsPage /></AuthGuard>} />
        <Route path="/admin/logs"                   element={<AuthGuard permission="logs.view"><ActivityLogsPage /></AuthGuard>} />
        <Route path="/admin/tickets"                element={<AuthGuard permission="tickets.view"><SupportTicketsPage /></AuthGuard>} />
        <Route path="/admin/settings"               element={<AuthGuard permission="settings.view"><SettingsPage /></AuthGuard>} />
        <Route path="/admin/settings/login-pages"   element={<AuthGuard permission="settings.manage"><LoginPagesPage /></AuthGuard>} />
        <Route path="/admin/settings/secrets"       element={<AuthGuard><SecretsPage /></AuthGuard>} />
        <Route path="/admin/security"               element={<AuthGuard permission="roles.manage"><AdminSecurityPage /></AuthGuard>} />
        <Route path="/admin/organizations"          element={<AuthGuard permission="orgs.view"><AdminOrganizationsPage /></AuthGuard>} />
      </Route>

      {/* Sub-admin */}
      <Route element={<AuthGuard roleRoute="subadmin"><AppShell /></AuthGuard>}>
        <Route path="/subadmin" element={<SubAdminDashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
