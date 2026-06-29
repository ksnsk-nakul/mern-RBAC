import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Badge }  from '@/components/ui/badge'

interface Activity {
  id: string; action: string; description: string; createdAt: string
}
interface Task {
  id: string; title: string; status: string; priority: string
  dueDate: string | null; notes: string; completedAt: string | null
  projectId: string | null; activities: Activity[]
}

export default function TaskDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [task,    setTask]    = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [notes,   setNotes]   = useState('')
  const [saving,  setSaving]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/tms/tasks/${id}`)
      setTask(data.task)
      setNotes(data.task.notes ?? '')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  async function handleSaveNotes() {
    setSaving(true)
    try {
      await api.patch(`/tms/tasks/${id}`, { notes })
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle() {
    if (!task) return
    if (task.status === 'done') {
      await api.post(`/tms/tasks/${id}/reopen`)
    } else {
      await api.post(`/tms/tasks/${id}/complete`)
    }
    await load()
  }

  if (loading) return <p className="text-sm text-muted-foreground p-4">Loading…</p>
  if (!task) return <p className="text-sm text-destructive p-4">Task not found.</p>

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(task.projectId ? `/dashboard/projects/${task.projectId}` : '/dashboard/tasks')}>
          ← Back
        </Button>
        <h1 className={`text-xl font-semibold flex-1 ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
          {task.title}
        </h1>
        <Badge variant={task.status === 'done' ? 'secondary' : task.status === 'in_progress' ? 'default' : 'outline'}>
          {task.status.replace(/_/g, ' ')}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="text-muted-foreground">Priority: <strong>{task.priority}</strong></span>
        {task.dueDate && <span className="text-muted-foreground">Due: <strong>{new Date(task.dueDate).toLocaleDateString()}</strong></span>}
        {task.completedAt && <span className="text-muted-foreground">Completed: <strong>{new Date(task.completedAt).toLocaleDateString()}</strong></span>}
      </div>

      <Button size="sm" variant={task.status === 'done' ? 'outline' : 'default'} onClick={() => void handleToggle()}>
        {task.status === 'done' ? 'Reopen task' : 'Mark as done'}
      </Button>

      <div className="space-y-2">
        <p className="text-sm font-medium">Notes</p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
          placeholder="Add notes…"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        <Button size="sm" variant="outline" onClick={() => void handleSaveNotes()} disabled={saving}>
          {saving ? '…' : 'Save notes'}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Activity</p>
        <div className="space-y-1.5">
          {task.activities.length === 0
            ? <p className="text-xs text-muted-foreground">No activity yet.</p>
            : task.activities.map((a) => (
              <div key={a.id} className="flex gap-2 text-xs text-muted-foreground">
                <span className="text-foreground font-medium">{a.action}</span>
                <span>{a.description}</span>
                <span className="ml-auto">{new Date(a.createdAt).toLocaleString()}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}
