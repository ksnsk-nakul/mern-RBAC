import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/axios'

interface Stats {
  todayTasks:        number
  activeProjects:    number
  overdueTasks:      number
  completedThisWeek: number
}

const STAT_CARDS = [
  { key: 'todayTasks',        label: "Today's tasks",       to: '/dashboard/planner' },
  { key: 'activeProjects',    label: 'Active projects',     to: '/dashboard/projects' },
  { key: 'overdueTasks',      label: 'Overdue tasks',       to: '/dashboard/planner' },
  { key: 'completedThisWeek', label: 'Completed this week', to: '/dashboard/tasks' },
] as const

export default function UserDashboard() {
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/tms/stats')
      setStats(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your daily snapshot across tasks and projects.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map(({ key, label, to }) => (
          <Link key={key} to={to}
            className="rounded-xl border bg-card p-4 shadow-sm hover:bg-accent transition-colors block">
            <div className="text-xs font-medium text-muted-foreground">{label}</div>
            <div className="mt-3 text-2xl font-semibold">
              {loading ? '—' : (stats?.[key] ?? 0)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
