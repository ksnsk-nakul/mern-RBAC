import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import { Badge }  from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'

interface Task {
  id:        string
  title:     string
  status:    string
  priority:  string
  dueDate:   string | null
  projectId: string | null
  updatedAt: string
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  todo: 'outline', in_progress: 'default', done: 'secondary',
}
const PRIORITY_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  low: 'outline', medium: 'secondary', high: 'default',
}

export default function TasksPage() {
  const navigate = useNavigate()
  const [tasks,      setTasks]      = useState<Task[]>([])
  const [loading,    setLoading]    = useState(true)
  const [status,     setStatus]     = useState('')
  const [priority,   setPriority]   = useState('')
  const [showForm,   setShowForm]   = useState(false)
  const [newTitle,   setNewTitle]   = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status)   params.set('status',   status)
      if (priority) params.set('priority', priority)
      const { data } = await api.get(`/tms/tasks?${params}`)
      setTasks(data.tasks)
    } finally {
      setLoading(false)
    }
  }, [status, priority])

  useEffect(() => { void load() }, [load])

  async function handleCreate() {
    if (!newTitle.trim()) return
    setSubmitting(true)
    try {
      await api.post('/tms/tasks', { title: newTitle.trim() })
      setNewTitle('')
      setShowForm(false)
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleComplete(id: string) {
    await api.post(`/tms/tasks/${id}/complete`)
    await load()
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-muted-foreground">All your tasks in one place.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New task'}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border p-3 flex gap-2">
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Task title" onKeyDown={(e) => e.key === 'Enter' && void handleCreate()} />
          <Button size="sm" onClick={() => void handleCreate()} disabled={submitting || !newTitle.trim()}>
            {submitting ? '…' : 'Add'}
          </Button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {['', 'todo', 'in_progress', 'done'].map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${status === s ? 'bg-[--role-accent] text-white border-[--role-accent]' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            {s || 'All status'}
          </button>
        ))}
        {['', 'low', 'medium', 'high'].map((p) => (
          <button key={p} onClick={() => setPriority(p)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${priority === p ? 'bg-[--role-accent] text-white border-[--role-accent]' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            {p || 'All priority'}
          </button>
        ))}
      </div>

      {loading
        ? <p className="text-sm text-muted-foreground">Loading…</p>
        : tasks.length === 0
          ? <p className="text-sm text-muted-foreground">No tasks found.</p>
          : (
            <div className="space-y-1.5">
              {tasks.map((t) => (
                <div key={t.id} className={`flex items-center gap-2 rounded-lg border p-3 ${t.status === 'done' ? 'opacity-60' : ''}`}>
                  {t.status !== 'done' && (
                    <button onClick={() => void handleComplete(t.id)}
                      className="h-4 w-4 shrink-0 rounded-full border border-muted-foreground hover:border-primary hover:bg-primary/20" />
                  )}
                  <button className="flex-1 text-left text-sm font-medium truncate hover:underline"
                    onClick={() => navigate(`/dashboard/tasks/${t.id}`)}>
                    <span className={t.status === 'done' ? 'line-through' : ''}>{t.title}</span>
                  </button>
                  <Badge variant={STATUS_VARIANT[t.status] ?? 'outline'}>{t.status.replace(/_/g, ' ')}</Badge>
                  <Badge variant={PRIORITY_VARIANT[t.priority] ?? 'outline'}>{t.priority}</Badge>
                  {t.dueDate && (
                    <span className="text-xs text-muted-foreground">{new Date(t.dueDate).toLocaleDateString()}</span>
                  )}
                </div>
              ))}
            </div>
          )
      }
    </div>
  )
}
