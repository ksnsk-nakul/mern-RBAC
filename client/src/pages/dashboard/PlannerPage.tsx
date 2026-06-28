import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import { Badge } from '@/components/ui/badge'

interface TaskItem {
  id:       string
  title:    string
  priority: string
  dueDate:  string | null
  status:   string
  projectId: string | null
}

interface PlannerData {
  today:    TaskItem[]
  overdue:  TaskItem[]
  upcoming: TaskItem[]
}

const PRIORITY_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  low: 'outline', medium: 'secondary', high: 'default',
}

function TaskCard({ task, onComplete }: { task: TaskItem; onComplete: (id: string) => void }) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center gap-2 rounded-lg border p-3 hover:bg-accent/50 transition-colors">
      <button
        onClick={() => onComplete(task.id)}
        className="h-4 w-4 shrink-0 rounded-full border border-muted-foreground hover:border-primary hover:bg-primary/20 transition-colors"
        title="Mark done"
      />
      <button className="flex-1 text-left text-sm font-medium truncate" onClick={() => navigate(`/dashboard/tasks/${task.id}`)}>
        {task.title}
      </button>
      <Badge variant={PRIORITY_VARIANT[task.priority] ?? 'outline'} className="shrink-0">{task.priority}</Badge>
      {task.dueDate && (
        <span className="text-xs text-muted-foreground shrink-0">{new Date(task.dueDate).toLocaleDateString()}</span>
      )}
    </div>
  )
}

function Column({ title, tasks, color, onComplete }: { title: string; tasks: TaskItem[]; color: string; onComplete: (id: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className={`text-sm font-semibold ${color}`}>{title}</h2>
        <span className="text-xs text-muted-foreground">({tasks.length})</span>
      </div>
      {tasks.length === 0
        ? <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-4 text-center">None</p>
        : tasks.map((t) => <TaskCard key={t.id} task={t} onComplete={onComplete} />)
      }
    </div>
  )
}

export default function PlannerPage() {
  const [data,    setData]    = useState<PlannerData>({ today: [], overdue: [], upcoming: [] })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: d } = await api.get('/tms/tasks/planner')
      setData(d)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleComplete(id: string) {
    await api.post(`/tms/tasks/${id}/complete`)
    await load()
  }

  if (loading) return <p className="text-sm text-muted-foreground p-4">Loading…</p>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Planner</h1>
        <p className="text-sm text-muted-foreground">Your daily task breakdown.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Column title="Today" tasks={data.today} color="text-primary" onComplete={(id) => void handleComplete(id)} />
        <Column title="Overdue" tasks={data.overdue} color="text-destructive" onComplete={(id) => void handleComplete(id)} />
        <Column title="Upcoming (7 days)" tasks={data.upcoming} color="text-muted-foreground" onComplete={(id) => void handleComplete(id)} />
      </div>
    </div>
  )
}
