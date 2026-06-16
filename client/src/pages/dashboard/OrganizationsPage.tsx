import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Badge }  from '@/components/ui/badge'

interface OrgWithRole {
  id:      string
  name:    string
  slug:    string
  orgRole: string
  status:  string
}

export default function UserOrganizationsPage() {
  const { user, setAuth, role, permissions } = useAuthStore()
  const [orgs,      setOrgs]      = useState<OrgWithRole[]>([])
  const [loading,   setLoading]   = useState(true)
  const [token,     setToken]     = useState('')
  const [accepting, setAccepting] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const [clearing,  setClearing]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/auth/orgs')
      setOrgs(data.orgs)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleSwitch(orgId: string, orgName: string, orgSlug: string) {
    setSwitching(orgId)
    try {
      await api.post(`/auth/orgs/${orgId}/switch`)
      if (user && role) {
        setAuth({ ...user, currentOrg: { id: orgId, name: orgName, slug: orgSlug } }, role, permissions)
      }
    } catch {
      alert('Failed to switch organization.')
    } finally {
      setSwitching(null)
    }
  }

  async function handleClear() {
    setClearing(true)
    try {
      await api.delete('/auth/orgs/switch')
      if (user && role) {
        setAuth({ ...user, currentOrg: null }, role, permissions)
      }
    } catch {
      alert('Failed to clear organization.')
    } finally {
      setClearing(false)
    }
  }

  async function handleAccept() {
    if (!token.trim()) return
    setAccepting(true)
    try {
      await api.post('/auth/orgs/invite/accept', { token: token.trim() })
      setToken('')
      await load()
    } catch {
      alert('Failed to accept invitation. The token may be invalid or already used.')
    } finally {
      setAccepting(false)
    }
  }

  const activeOrgId = user?.currentOrg?.id

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Organizations</h1>
        <p className="text-sm text-muted-foreground">Switch between your organization memberships.</p>
      </div>

      {user?.currentOrg && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex-1">
            <p className="text-sm font-medium">Active: {user.currentOrg.name}</p>
            <code className="text-xs text-muted-foreground">{user.currentOrg.slug}</code>
          </div>
          <Button size="sm" variant="outline" onClick={() => void handleClear()} disabled={clearing}>
            {clearing ? '…' : 'Clear'}
          </Button>
        </div>
      )}

      {loading
        ? <p className="text-sm text-muted-foreground">Loading…</p>
        : orgs.length === 0
          ? <p className="text-sm text-muted-foreground">You don't belong to any organizations yet.</p>
          : (
            <div className="space-y-2">
              {orgs.map((org) => (
                <div key={org.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{org.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs text-muted-foreground">{org.slug}</code>
                      <Badge variant="secondary">{org.orgRole}</Badge>
                      {org.status !== 'active' && <Badge variant="secondary" className="text-xs">{org.status}</Badge>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={activeOrgId === org.id ? 'default' : 'outline'}
                    onClick={() => void handleSwitch(org.id, org.name, org.slug)}
                    disabled={activeOrgId === org.id || switching === org.id}
                  >
                    {activeOrgId === org.id ? 'Active' : switching === org.id ? '…' : 'Switch'}
                  </Button>
                </div>
              ))}
            </div>
          )
      }

      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-medium">Accept an invitation</p>
        <p className="text-xs text-muted-foreground">Paste your invitation token to join an organization.</p>
        <div className="flex gap-2">
          <Input value={token} onChange={(e) => setToken(e.target.value)}
            placeholder="Paste invitation token…" className="flex-1 font-mono text-xs" />
          <Button size="sm" onClick={() => void handleAccept()} disabled={accepting || !token.trim()}>
            {accepting ? '…' : 'Accept'}
          </Button>
        </div>
      </div>
    </div>
  )
}
