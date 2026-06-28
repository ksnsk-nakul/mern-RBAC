// client/src/pages/admin/SupportTicketsPage.tsx
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/axios'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { Badge }  from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface TicketRow {
  id:          string
  subject:     string
  status:      string
  priority:    string
  requestedBy: string
  assignedTo?: string
  createdAt:   string
}

type StatusFilter = 'all' | 'open' | 'in_progress' | 'waiting_for_user' | 'resolved' | 'closed'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  open:              'default',
  in_progress:       'secondary',
  waiting_for_user:  'outline',
  resolved:          'secondary',
  closed:            'outline',
}

const PRIORITY_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  low:    'outline',
  medium: 'secondary',
  high:   'default',
  urgent: 'destructive',
}

const COLUMNS: Column<TicketRow>[] = [
  { key: 'subject',  header: 'Subject',   render: (r) => <span className="font-medium text-sm">{r.subject}</span> },
  { key: 'status',   header: 'Status',    render: (r) => <Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'}>{r.status.replace(/_/g, ' ')}</Badge> },
  { key: 'priority', header: 'Priority',  render: (r) => <Badge variant={PRIORITY_VARIANT[r.priority] ?? 'outline'}>{r.priority}</Badge> },
  { key: 'created',  header: 'Submitted', render: (r) => <span className="text-sm text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span> },
]

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all',              label: 'All' },
  { key: 'open',             label: 'Open' },
  { key: 'in_progress',      label: 'In Progress' },
  { key: 'waiting_for_user', label: 'Waiting' },
  { key: 'resolved',         label: 'Resolved' },
  { key: 'closed',           label: 'Closed' },
]

export default function SupportTicketsPage() {
  const navigate = useNavigate()
  const [tickets,      setTickets]      = useState<TicketRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = statusFilter === 'all' ? '' : `?status=${statusFilter}`
      const { data } = await api.get(`/admin/tickets${params}`)
      setTickets(data.tickets)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Support Tickets</h1>
        <p className="text-sm text-muted-foreground">Manage user support requests.</p>
      </div>

      <div className="flex gap-1 border-b">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === f.key
                ? 'border-[--role-accent] text-[--role-accent]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={COLUMNS}
        data={tickets}
        loading={loading}
        emptyText="No tickets found."
        actions={(t) => (
          <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/tickets/${t.id}`)}>
            View
          </Button>
        )}
      />
    </div>
  )
}
