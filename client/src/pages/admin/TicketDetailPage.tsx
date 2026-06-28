// client/src/pages/admin/TicketDetailPage.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Badge }  from '@/components/ui/badge'
import { usePermission } from '@/hooks/usePermission'

interface Attachment { filename: string; contentType: string; size: number; gridfsId: string }

interface Message {
  id:          string
  userId:      string
  body:        string
  isInternal:  boolean
  attachments: Attachment[]
  createdAt:   string
}

interface Ticket {
  id:          string
  subject:     string
  status:      string
  priority:    string
  requestedBy: string
  assignedTo?: string
  messages:    Message[]
}

interface AdminUser { id: string; name: string; email: string }

const STATUS_OPTIONS = ['open', 'in_progress', 'waiting_for_user', 'resolved', 'closed'] as const
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'] as const

export default function AdminTicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasPermission } = usePermission()
  const canManage = hasPermission('tickets.manage')

  const [ticket,     setTicket]     = useState<Ticket | null>(null)
  const [admins,     setAdmins]     = useState<AdminUser[]>([])
  const [loading,    setLoading]    = useState(true)
  const [status,     setStatus]     = useState('')
  const [priority,   setPriority]   = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [body,       setBody]       = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [files,      setFiles]      = useState<File[]>([])
  const [sending,    setSending]    = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ticketRes, usersRes] = await Promise.all([
        api.get(`/admin/tickets/${id}`),
        api.get('/admin/users'),
      ])
      const t: Ticket = ticketRes.data.ticket
      setTicket(t)
      setStatus(t.status)
      setPriority(t.priority)
      setAssignedTo(t.assignedTo ?? '')
      setAdmins(usersRes.data.users ?? [])
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  async function handleSaveMeta() {
    if (!canManage) return
    setSaving(true)
    try {
      await api.patch(`/admin/tickets/${id}`, {
        status,
        priority,
        assignedTo: assignedTo || null,
      })
      await load()
    } catch {
      alert('Failed to update ticket.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSendMessage() {
    if (!body.trim()) return
    setSending(true)
    try {
      const form = new FormData()
      form.append('body', body.trim())
      form.append('isInternal', String(isInternal))
      files.forEach((f) => form.append('files', f))
      await api.post(`/admin/tickets/${id}/messages`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setBody('')
      setIsInternal(false)
      setFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      await load()
    } catch {
      alert('Failed to send message.')
    } finally {
      setSending(false)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground p-4">Loading…</p>
  if (!ticket) return <p className="text-sm text-destructive p-4">Ticket not found.</p>

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/tickets')}>← Back</Button>
        <h1 className="text-xl font-semibold">{ticket.subject}</h1>
        <Badge variant="secondary">{ticket.status.replace(/_/g, ' ')}</Badge>
      </div>

      {canManage && (
        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-sm font-medium">Ticket settings</p>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="rounded-md border bg-background px-3 py-2 text-sm">
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}
                className="rounded-md border bg-background px-3 py-2 text-sm">
                {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Assigned to</label>
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}
                className="rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">Unassigned</option>
                {admins.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <Button size="sm" onClick={() => void handleSaveMeta()} disabled={saving}>
            {saving ? '…' : 'Save changes'}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <div key={m.id} className={`rounded-lg border p-3 ${m.isInternal ? 'bg-muted/40' : ''}`}>
            {m.isInternal && <p className="text-xs font-semibold text-muted-foreground mb-1">Internal note</p>}
            <p className="text-sm whitespace-pre-wrap">{m.body}</p>
            {m.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {m.attachments.map((a) => (
                  <a key={a.gridfsId}
                    href={`/api/admin/tickets/${ticket.id}/messages/${m.id}/attachments/${a.gridfsId}`}
                    className="text-xs underline text-primary" target="_blank" rel="noreferrer">
                    {a.filename}
                  </a>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">{new Date(m.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-medium">Reply</p>
        <textarea value={body} onChange={(e) => setBody(e.target.value)}
          rows={4} placeholder="Type your reply…"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileInputRef} type="file" multiple accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="text-sm" />
          {canManage && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="rounded" />
              Internal note
            </label>
          )}
          <Button size="sm" onClick={() => void handleSendMessage()} disabled={sending || !body.trim()}>
            {sending ? '…' : 'Send'}
          </Button>
        </div>
        {files.length > 0 && (
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {files.map((f, i) => <li key={i}>{f.name} ({Math.round(f.size / 1024)} KB)</li>)}
          </ul>
        )}
      </div>
    </div>
  )
}
