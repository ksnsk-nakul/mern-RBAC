import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthGuard }     from './AuthGuard'
import { AppShell }      from '@/components/layout/AppShell'
import LoginPage         from '@/pages/auth/LoginPage'
import GoogleCallback    from '@/pages/auth/GoogleCallback'
import UserDashboard     from '@/pages/dashboard/UserDashboard'
import AdminDashboard    from '@/pages/admin/AdminDashboard'
import UsersPage         from '@/pages/admin/UsersPage'
import SubAdminDashboard from '@/pages/subadmin/SubAdminDashboard'

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
      </Route>

      {/* Admin */}
      <Route element={<AuthGuard roleRoute="admin"><AppShell /></AuthGuard>}>
        <Route path="/admin"       element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AuthGuard permission="users.view"><UsersPage /></AuthGuard>} />
      </Route>

      {/* Sub-admin */}
      <Route element={<AuthGuard roleRoute="subadmin"><AppShell /></AuthGuard>}>
        <Route path="/subadmin" element={<SubAdminDashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
