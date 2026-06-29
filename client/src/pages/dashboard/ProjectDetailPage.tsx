import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Badge }  from '@/components/ui/badge'
import { Input }  from '@/components/ui/input'

interface Task {
  id: string; title: string; status: string; priority: string; dueDate: string | null
}
interface Project {
  id: string; title: string; description: string; status: string; progress: number; archivedAt: string | null
}

const PRIORITY_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  low: 'outline', medium: 'secondary', high: 'default',
}

export default function ProjectDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [project,    setProject]    = useState<Project | null>(null)
  const [tasks,      setTasks]      = useState<Task[]>([])
  const [loading,    setLoading]    = useState(true)
  const [newTitle,   setNewTitle]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [progress,   setProgress]   = useState(0)
  const [saving,     setSaving]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [projRes, tasksRes] = await Promise.all([
        api.get(`/tms/projects/${id}`),
        api.get(`/tms/tasks?project_id=${id}&limit=100`),
      ])
      setProject(projRes.data.project)
      setProgress(projRes.data.project.progress)
      setTasks(tasksRes.data.tasks)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  async function handleAddTask() {
    if (!newTitle.trim()) return
    setSubmitting(true)
    try {
      await api.post('/tms/tasks', { title: newTitle.trim(), projectId: id })
      setNewTitle('')
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleComplete(taskId: string) {
    await api.post(`/tms/tasks/${taskId}/complete`)
    await load()
  }

  async function handleSaveProgress() {
    setSaving(true)
    try {
      await api.patch(`/tms/projects/${id}`, { progress })
      await load()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground p-4">Loading…</p>
  if (!project) return <p className="text-sm text-destructive p-4">Project not found.</p>

  const open = tasks.filter((t) => t.status !== 'done')
  const done = tasks.filter((t) => t.status === 'done')

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/projects')}>← Back</Button>
        <h1 className="text-xl font-semibold flex-1">{project.title}</h1>
        <Badge variant={project.status === 'active' ? 'default' : 'outline'}>{project.status}</Badge>
      </div>

      {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}

      <div className="rounded-lg border p-4 space-y-2">
        <p className="text-sm font-medium">Progress</p>
        <div className="flex items-center gap-3">
          <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))}
            className="flex-1" />
          <span className="text-sm w-10 text-right">{progress}%</span>
          <Button size="sm" variant="outline" onClick={() => void handleSaveProgress()} disabled={saving}>
            {saving ? '…' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border p-3 flex gap-2">
        <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a task…" onKeyDown={(e) => e.key === 'Enter' && void handleAddTask()} />
        <Button size="sm" onClick={() => void handleAddTask()} disabled={submitting || !newTitle.trim()}>
          {submitting ? '…' : 'Add'}
        </Button>
      </div>

      <div className="space-y-1.5">
        {open.map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-lg border p-3">
            <button onClick={() => void handleComplete(t.id)}
              className="h-4 w-4 shrink-0 rounded-full border border-muted-foreground hover:border-primary hover:bg-primary/20" />
            <button className="flex-1 text-left text-sm font-medium hover:underline" onClick={() => navigate(`/dashboard/tasks/${t.id}`)}>
              {t.title}
            </button>
            <Badge variant={PRIORITY_VARIANT[t.priority] ?? 'outline'}>{t.priority}</Badge>
          </div>
        ))}
        {done.map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-lg border p-3 opacity-50">
            <span className="h-4 w-4 shrink-0 flex items-center justify-center text-xs">✓</span>
            <span className="flex-1 text-sm line-through text-muted-foreground">{t.title}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
