import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Badge }  from '@/components/ui/badge'

interface RoleOption { id: string; name: string; slug: string }

interface MyRequestItem {
  id:           string
  requestType:  'role_assignment' | 'permission_grant'
  targetRoleId: string
  status:       'pending' | 'approved' | 'rejected'
  reason?:      string
  decisionNote?: string
  createdAt:    string
}

function statusBadgeVariant(status: MyRequestItem['status']): 'default' | 'secondary' | 'destructive' {
  if (status === 'approved') return 'default'
  if (status === 'rejected') return 'destructive'
  return 'secondary'
}

export default function UserApprovalsPage() {
  const [roles,      setRoles]      = useState<RoleOption[]>([])
  const [requests,   setRequests]   = useState<MyRequestItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [roleId,     setRoleId]     = useState('')
  const [reason,     setReason]     = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rolesRes, requestsRes] = await Promise.all([
        api.get('/admin/roles'),
        api.get('/approvals/requests/mine'),
      ])
      setRoles(rolesRes.data.roles.map((r: { id: string; name: string; slug: string }) => ({ id: r.id, name: r.name, slug: r.slug })))
      setRequests(requestsRes.data.requests)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleSubmit() {
    if (!roleId) return
    setSubmitting(true)
    try {
      await api.post('/approvals/requests', { requestType: 'role_assignment', targetRoleId: roleId, reason: reason.trim() || undefined })
      setRoleId('')
      setReason('')
      await load()
    } catch {
      alert('Failed to submit request.')
    } finally {
      setSubmitting(false)
    }
  }

  function roleName(id: string): string {
    return roles.find((r) => r.id === id)?.name ?? id.slice(-8)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">My Requests</h1>
        <p className="text-sm text-muted-foreground">Request a role and track your past requests.</p>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-medium">Request a role</p>
        <select value={roleId} onChange={(e) => setRoleId(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm">
          <option value="">— Select a role —</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Why do you need this role? (optional)" rows={2}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        <Button size="sm" onClick={() => void handleSubmit()} disabled={submitting || !roleId}>
          {submitting ? '…' : 'Submit request'}
        </Button>
      </div>

      {loading
        ? <p className="text-sm text-muted-foreground">Loading…</p>
        : requests.length === 0
          ? <p className="text-sm text-muted-foreground">No requests yet.</p>
          : (
            <div className="space-y-2">
              {requests.map((r) => (
                <div key={r.id} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{roleName(r.targetRoleId)}</p>
                    <Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge>
                  </div>
                  {r.reason && <p className="text-xs text-muted-foreground mt-1">"{r.reason}"</p>}
                  {r.decisionNote && <p className="text-xs text-muted-foreground mt-1">Note: "{r.decisionNote}"</p>}
                </div>
              ))}
            </div>
          )
      }
    </div>
  )
}
