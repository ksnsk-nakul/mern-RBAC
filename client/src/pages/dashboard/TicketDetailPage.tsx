import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Badge }  from '@/components/ui/badge'

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
  id:       string
  subject:  string
  status:   string
  messages: Message[]
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  open: 'default', in_progress: 'secondary', waiting_for_user: 'outline',
  resolved: 'secondary', closed: 'outline',
}

export default function UserTicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [ticket,  setTicket]  = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [body,    setBody]    = useState('')
  const [files,   setFiles]   = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/tickets/${id}`)
      setTicket(data.ticket)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  async function handleReply() {
    if (!body.trim()) return
    setSending(true)
    try {
      const form = new FormData()
      form.append('body', body.trim())
      files.forEach((f) => form.append('files', f))
      await api.post(`/tickets/${id}/messages`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setBody('')
      setFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      await load()
    } catch {
      alert('Failed to send reply.')
    } finally {
      setSending(false)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground p-4">Loading…</p>
  if (!ticket) return <p className="text-sm text-destructive p-4">Ticket not found.</p>

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/tickets')}>← Back</Button>
        <h1 className="text-xl font-semibold flex-1">{ticket.subject}</h1>
        <Badge variant={STATUS_VARIANT[ticket.status] ?? 'secondary'}>{ticket.status.replace(/_/g, ' ')}</Badge>
      </div>

      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <div key={m.id} className="rounded-lg border p-3">
            <p className="text-sm whitespace-pre-wrap">{m.body}</p>
            {m.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {m.attachments.map((a) => (
                  <a key={a.gridfsId}
                    href={`/api/tickets/${ticket.id}/messages/${m.id}/attachments/${a.gridfsId}`}
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
          rows={3} placeholder="Write a reply…"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileInputRef} type="file" multiple accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="text-sm" />
          <Button size="sm" onClick={() => void handleReply()} disabled={sending || !body.trim()}>
            {sending ? '…' : 'Send reply'}
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
