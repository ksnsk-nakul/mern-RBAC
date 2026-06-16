import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Badge }  from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

interface OrgItem    { id: string; name: string; slug: string; createdAt: string }
interface MemberItem { userId: string; orgRole: string; status: string }

// ─── Members Panel ────────────────────────────────────────────────────────────

function MembersPanel({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const [members,      setMembers]      = useState<MemberItem[]>([])
  const [loading,      setLoading]      = useState(true)
  const [addId,        setAddId]        = useState('')
  const [addRole,      setAddRole]      = useState<'owner' | 'admin' | 'member'>('member')
  const [adding,       setAdding]       = useState(false)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/admin/orgs/${orgId}/members`)
      setMembers(data.members)
    } finally { setLoading(false) }
  }, [orgId])

  useEffect(() => { void load() }, [load])

  async function handleAdd() {
    if (!addId.trim()) return
    setAdding(true)
    try {
      await api.post(`/admin/orgs/${orgId}/members`, { userId: addId.trim(), orgRole: addRole })
      setAddId('')
      await load()
    } finally { setAdding(false) }
  }

  async function handleRemove(userId: string) {
    await api.delete(`/admin/orgs/${orgId}/members/${userId}`)
    setMembers((m) => m.filter((x) => x.userId !== userId))
    setRemoveTarget(null)
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Members ({members.length})</p>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>

      {loading
        ? <p className="text-xs text-muted-foreground">Loading…</p>
        : members.length === 0
          ? <p className="text-xs text-muted-foreground">No members.</p>
          : members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <code className="text-xs text-muted-foreground">{m.userId.slice(-8)}</code>
                <Badge variant="secondary">{m.orgRole}</Badge>
                {m.status !== 'active' && <Badge variant="destructive">{m.status}</Badge>}
              </div>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                onClick={() => setRemoveTarget(m.userId)}>Remove</Button>
            </div>
          ))
      }

      <div className="flex gap-2 pt-2 border-t">
        <Input value={addId} onChange={(e) => setAddId(e.target.value)}
          placeholder="User ID" className="flex-1 text-xs" />
        <select value={addRole} onChange={(e) => setAddRole(e.target.value as 'owner' | 'admin' | 'member')}
          className="rounded-md border bg-background px-2 text-xs">
          <option value="member">Member</option>
          <option value="admin">Admin</option>
          <option value="owner">Owner</option>
        </select>
        <Button size="sm" onClick={() => void handleAdd()} disabled={adding || !addId.trim()}>Add</Button>
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove member"
        message="Remove this member from the organization?"
        danger
        onConfirm={() => { if (removeTarget) void handleRemove(removeTarget) }}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminOrganizationsPage() {
  const [orgs,         setOrgs]         = useState<OrgItem[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [newName,      setNewName]      = useState('')
  const [creating,     setCreating]     = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/admin/orgs?search=${encodeURIComponent(search)}&limit=50`)
      setOrgs(data.orgs)
    } finally { setLoading(false) }
  }, [search])

  useEffect(() => { void load() }, [load])

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await api.post('/admin/orgs', { name: newName.trim() })
      setNewName('')
      await load()
    } finally { setCreating(false) }
  }

  async function handleDelete(id: string) {
    await api.delete(`/admin/orgs/${id}`)
    setOrgs((o) => o.filter((x) => x.id !== id))
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organizations</h1>
        <p className="text-sm text-muted-foreground">Manage tenant organizations and their members.</p>
      </div>

      <div className="flex gap-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search organizations…" className="max-w-xs" />
        <div className="flex gap-2 ml-auto">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="New org name" className="max-w-xs" />
          <Button size="sm" onClick={() => void handleCreate()} disabled={creating || !newName.trim()}>
            {creating ? '…' : 'Create'}
          </Button>
        </div>
      </div>

      {loading
        ? <p className="text-sm text-muted-foreground">Loading…</p>
        : orgs.length === 0
          ? <p className="text-sm text-muted-foreground">No organizations yet.</p>
          : (
            <div className="space-y-2">
              {orgs.map((org) => (
                <div key={org.id} className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{org.name}</p>
                      <code className="text-xs text-muted-foreground">{org.slug}</code>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline"
                        onClick={() => setExpanded(expanded === org.id ? null : org.id)}>
                        {expanded === org.id ? 'Hide members' : 'Members'}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(org.id)}>Delete</Button>
                    </div>
                  </div>

                  {expanded === org.id && (
                    <MembersPanel orgId={org.id} onClose={() => setExpanded(null)} />
                  )}
                </div>
              ))}
            </div>
          )
      }

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete organization"
        message="Delete this organization and remove all members? This cannot be undone."
        danger
        onConfirm={() => { if (deleteTarget) void handleDelete(deleteTarget) }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
