import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Badge }  from '@/components/ui/badge'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'

interface TicketRow {
  id:        string
  subject:   string
  status:    string
  updatedAt: string
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  open: 'default', in_progress: 'secondary', waiting_for_user: 'outline',
  resolved: 'secondary', closed: 'outline',
}

export default function UserTicketsPage() {
  const navigate = useNavigate()
  const [tickets,    setTickets]    = useState<TicketRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [subject,    setSubject]    = useState('')
  const [body,       setBody]       = useState('')
  const [files,      setFiles]      = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/tickets')
      setTickets(data.tickets)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleSubmit() {
    if (!subject.trim() || !body.trim()) return
    setSubmitting(true)
    try {
      const form = new FormData()
      form.append('subject', subject.trim())
      form.append('body', body.trim())
      files.forEach((f) => form.append('files', f))
      await api.post('/tickets', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setSubject('')
      setBody('')
      setFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      await load()
    } catch {
      alert('Failed to submit ticket.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">My Tickets</h1>
        <p className="text-sm text-muted-foreground">Submit and track your support requests.</p>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-medium">New ticket</p>
        <div className="space-y-1">
          <Label>Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief description of your issue" />
        </div>
        <div className="space-y-1">
          <Label>Message</Label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)}
            rows={4} placeholder="Describe your issue in detail…"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <Label>Attachments (optional)</Label>
          <input ref={fileInputRef} type="file" multiple accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="text-sm" />
          {files.length > 0 && (
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {files.map((f, i) => <li key={i}>{f.name} ({Math.round(f.size / 1024)} KB)</li>)}
            </ul>
          )}
        </div>
        <Button size="sm" onClick={() => void handleSubmit()} disabled={submitting || !subject.trim() || !body.trim()}>
          {submitting ? '…' : 'Submit ticket'}
        </Button>
      </div>

      {loading
        ? <p className="text-sm text-muted-foreground">Loading…</p>
        : tickets.length === 0
          ? <p className="text-sm text-muted-foreground">No tickets yet.</p>
          : (
            <div className="space-y-2">
              {tickets.map((t) => (
                <button key={t.id} onClick={() => navigate(`/dashboard/tickets/${t.id}`)}
                  className="w-full rounded-lg border p-3 text-left hover:bg-accent transition-colors">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium flex-1">{t.subject}</p>
                    <Badge variant={STATUS_VARIANT[t.status] ?? 'secondary'}>{t.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(t.updatedAt).toLocaleDateString()}</p>
                </button>
              ))}
            </div>
          )
      }
    </div>
  )
}
