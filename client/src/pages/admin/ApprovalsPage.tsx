import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Badge }  from '@/components/ui/badge'

interface ApprovalRequestItem {
  id:                  string
  requestType:         'role_assignment' | 'permission_grant'
  requestedBy:         string
  targetUserId?:       string
  targetRoleId:        string
  targetPermissionId?: string
  status:              'pending' | 'approved' | 'rejected'
  reason?:             string
  decisionNote?:       string
  createdAt:           string
}

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all'

function statusBadgeVariant(status: ApprovalRequestItem['status']): 'default' | 'secondary' | 'destructive' {
  if (status === 'approved') return 'default'
  if (status === 'rejected') return 'destructive'
  return 'secondary'
}

function DecisionDialog({ open, title, onConfirm, onCancel, loading }: {
  open: boolean; title: string; onConfirm: (note: string) => void; onCancel: () => void; loading: boolean
}) {
  const [note, setNote] = useState('')
  useEffect(() => { if (open) setNote('') }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-xl space-y-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <textarea value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Optional decision note" rows={3}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button onClick={() => onConfirm(note)} disabled={loading}>{loading ? '…' : 'Confirm'}</Button>
        </div>
      </div>
    </div>
  )
}

export default function ApprovalsPage() {
  const [requests,    setRequests]    = useState<ApprovalRequestItem[]>([])
  const [loading,     setLoading]     = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [decisionTarget, setDecisionTarget] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null)
  const [deciding, setDeciding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = statusFilter === 'all' ? '' : `?status=${statusFilter}`
      const { data } = await api.get(`/admin/approvals${params}`)
      setRequests(data.requests)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { void load() }, [load])

  async function handleDecision(note: string) {
    if (!decisionTarget) return
    setDeciding(true)
    try {
      await api.post(`/admin/approvals/${decisionTarget.id}/${decisionTarget.action}`, { decisionNote: note || undefined })
      await load()
    } catch {
      alert('Failed to record decision.')
    } finally {
      setDeciding(false)
      setDecisionTarget(null)
    }
  }

  function describeTarget(r: ApprovalRequestItem): string {
    if (r.requestType === 'role_assignment') return `Role ${r.targetRoleId.slice(-8)}`
    return `Role ${r.targetRoleId.slice(-8)} + Permission ${r.targetPermissionId?.slice(-8)}`
  }

  const filters: { key: StatusFilter; label: string }[] = [
    { key: 'pending',  label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all',      label: 'All' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Approval Requests</h1>
        <p className="text-sm text-muted-foreground">Review role assignment and permission grant requests.</p>
      </div>

      <div className="flex gap-1 border-b">
        {filters.map((f) => (
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

      {loading
        ? <p className="text-sm text-muted-foreground">Loading…</p>
        : requests.length === 0
          ? <p className="text-sm text-muted-foreground">No requests.</p>
          : (
            <div className="space-y-2">
              {requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs">{r.requestType}</code>
                      <Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge>
                    </div>
                    <p className="text-sm mt-1">{describeTarget(r)}</p>
                    {r.reason && <p className="text-xs text-muted-foreground mt-1">"{r.reason}"</p>}
                    {r.decisionNote && <p className="text-xs text-muted-foreground mt-1">Note: "{r.decisionNote}"</p>}
                  </div>
                  {r.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setDecisionTarget({ id: r.id, action: 'reject' })}>Reject</Button>
                      <Button size="sm" onClick={() => setDecisionTarget({ id: r.id, action: 'approve' })}>Approve</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
      }

      <DecisionDialog
        open={!!decisionTarget}
        title={decisionTarget?.action === 'approve' ? 'Approve request' : 'Reject request'}
        loading={deciding}
        onConfirm={(note) => void handleDecision(note)}
        onCancel={() => setDecisionTarget(null)}
      />
    </div>
  )
}
