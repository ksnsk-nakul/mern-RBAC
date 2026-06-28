import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Badge }  from '@/components/ui/badge'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'

interface Project {
  id:          string
  title:       string
  description: string
  status:      string
  progress:    number
  archivedAt:  string | null
  updatedAt:   string
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  active: 'default', paused: 'outline', completed: 'secondary',
}

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [projects,        setProjects]        = useState<Project[]>([])
  const [loading,         setLoading]         = useState(true)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [showForm,        setShowForm]        = useState(false)
  const [title,           setTitle]           = useState('')
  const [description,     setDescription]     = useState('')
  const [submitting,      setSubmitting]      = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/tms/projects${includeArchived ? '?include_archived=true' : ''}`)
      setProjects(data.projects)
    } finally {
      setLoading(false)
    }
  }, [includeArchived])

  useEffect(() => { void load() }, [load])

  async function handleCreate() {
    if (!title.trim()) return
    setSubmitting(true)
    try {
      await api.post('/tms/projects', { title: title.trim(), description: description.trim() })
      setTitle('')
      setDescription('')
      setShowForm(false)
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleArchive(id: string, isArchived: boolean) {
    await api.post(`/tms/projects/${id}/${isArchived ? 'unarchive' : 'archive'}`)
    await load()
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">Manage your projects.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New project'}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project title" />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              rows={2} placeholder="Optional description"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          </div>
          <Button size="sm" onClick={() => void handleCreate()} disabled={submitting || !title.trim()}>
            {submitting ? '…' : 'Create project'}
          </Button>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
        Show archived
      </label>

      {loading
        ? <p className="text-sm text-muted-foreground">Loading…</p>
        : projects.length === 0
          ? <p className="text-sm text-muted-foreground">No projects yet.</p>
          : (
            <div className="space-y-2">
              {projects.map((p) => (
                <div key={p.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <button className="flex-1 text-left text-sm font-medium hover:underline" onClick={() => navigate(`/dashboard/projects/${p.id}`)}>
                      {p.title}
                    </button>
                    <Badge variant={STATUS_VARIANT[p.status] ?? 'outline'}>{p.status}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => void handleArchive(p.id, !!p.archivedAt)}>
                      {p.archivedAt ? 'Unarchive' : 'Archive'}
                    </Button>
                  </div>
                  {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-[--role-accent]" style={{ width: `${p.progress}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{p.progress}% complete</p>
                </div>
              ))}
            </div>
          )
      }
    </div>
  )
}
