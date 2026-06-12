import { useEffect, useState } from 'react'
import api from '@/lib/axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Stats {
  userCount:          number
  roleCount:          number
  activeSessionCount: number
  recentAssignments:  Array<{
    userName:   string
    userEmail:  string
    roleName:   string
    roleColor:  string
    assignedAt: string
  }>
}

export default function AdminDashboard() {
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/stats')
      .then(({ data }) => setStats(data))
      .finally(() => setLoading(false))
  }, [])

  const statCards = [
    { label: 'Total Users',     value: stats?.userCount          ?? '—' },
    { label: 'Roles',           value: stats?.roleCount          ?? '—' },
    { label: 'Active Sessions', value: stats?.activeSessionCount ?? '—' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">System overview</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? <span className="animate-pulse text-muted-foreground">…</span> : s.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && stats && stats.recentAssignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Role Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {stats.recentAssignments.map((a, i) => (
                <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <span className="font-medium">{a.userName}</span>
                    <span className="ml-1 text-muted-foreground">({a.userEmail})</span>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: a.roleColor }}
                  >
                    {a.roleName}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
