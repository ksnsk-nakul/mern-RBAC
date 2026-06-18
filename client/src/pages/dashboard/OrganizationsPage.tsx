// client/src/pages/dashboard/OrganizationsPage.tsx
import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Badge }  from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

interface OrgWithRole {
  id:      string
  name:    string
  slug:    string
  orgRole: string
  status:  string
}

const WEBHOOK_EVENTS = [
  'login.success',
  'login.failed',
  'mfa.enabled',
  'mfa.disabled',
  'secret.revealed',
  'user.role_changed',
] as const

interface WebhookEndpointItem {
  id:        string
  url:       string
  events:    string[]
  active:    boolean
  createdAt: string
}

interface DeliveryItem {
  id:              string
  event:           string
  status:          'pending' | 'success' | 'failed'
  attempts:        number
  responseStatus?: number
  createdAt:       string
}

// ─── My Organizations Tab ───────────────────────────────────────────────────

function MyOrgsTab() {
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

// ─── Deliveries Panel ────────────────────────────────────────────────────────

function statusBadgeVariant(status: DeliveryItem['status']): 'default' | 'secondary' | 'destructive' {
  if (status === 'success') return 'default'
  if (status === 'failed')  return 'destructive'
  return 'secondary'
}

function DeliveriesPanel({ orgId, webhookId, onClose }: { orgId: string; webhookId: string; onClose: () => void }) {
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([])
  const [loading,     setLoading]   = useState(true)
  const [page,        setPage]      = useState(1)
  const [pages,        setPages]    = useState(1)
  const [retrying,    setRetrying]  = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/orgs/${orgId}/webhooks/${webhookId}/deliveries?page=${page}&limit=20`)
      setDeliveries(data.deliveries)
      setPages(data.pages)
    } finally { setLoading(false) }
  }, [orgId, webhookId, page])

  useEffect(() => { void load() }, [load])

  async function handleRetry(deliveryId: string) {
    setRetrying(deliveryId)
    try {
      await api.post(`/orgs/${orgId}/webhooks/${webhookId}/deliveries/${deliveryId}/retry`)
      await load()
    } catch {
      alert('Failed to retry delivery.')
    } finally {
      setRetrying(null)
    }
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Deliveries</p>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>

      {loading
        ? <p className="text-xs text-muted-foreground">Loading…</p>
        : deliveries.length === 0
          ? <p className="text-xs text-muted-foreground">No deliveries yet.</p>
          : (
            <div className="space-y-2">
              {deliveries.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <code className="text-xs">{d.event}</code>
                    <Badge variant={statusBadgeVariant(d.status)}>{d.status}</Badge>
                    <span className="text-xs text-muted-foreground">attempts: {d.attempts}</span>
                    {d.responseStatus !== undefined && <span className="text-xs text-muted-foreground">HTTP {d.responseStatus}</span>}
                  </div>
                  {d.status === 'failed' && (
                    <Button size="sm" variant="outline" onClick={() => void handleRetry(d.id)} disabled={retrying === d.id}>
                      {retrying === d.id ? '…' : 'Retry'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )
      }

      {pages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t">
          <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Previous</Button>
          <span className="text-xs text-muted-foreground">Page {page} of {pages}</span>
          <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}>Next</Button>
        </div>
      )}
    </div>
  )
}

// ─── Webhooks Tab ────────────────────────────────────────────────────────────

function WebhooksTab() {
  const { user } = useAuthStore()
  const orgId    = user?.currentOrg?.id

  const [endpoints,   setEndpoints]   = useState<WebhookEndpointItem[]>([])
  const [loading,     setLoading]     = useState(true)
  const [newUrl,      setNewUrl]      = useState('')
  const [newEvents,   setNewEvents]   = useState<string[]>([])
  const [creating,    setCreating]    = useState(false)
  const [newSecret,   setNewSecret]   = useState<string | null>(null)
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [regenTarget,  setRegenTarget]  = useState<string | null>(null)
  const [regenSecret,  setRegenSecret]  = useState<string | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const { data } = await api.get(`/orgs/${orgId}/webhooks`)
      setEndpoints(data.endpoints)
    } finally { setLoading(false) }
  }, [orgId])

  useEffect(() => { void load() }, [load])

  function toggleEvent(event: string) {
    setNewEvents((prev) => (prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]))
  }

  async function handleCreate() {
    if (!orgId || !newUrl.trim() || newEvents.length === 0) return
    setCreating(true)
    try {
      const { data } = await api.post(`/orgs/${orgId}/webhooks`, { url: newUrl.trim(), events: newEvents })
      setNewSecret(data.endpoint.secret)
      setNewUrl('')
      setNewEvents([])
      await load()
    } catch {
      alert('Failed to create webhook endpoint.')
    } finally {
      setCreating(false)
    }
  }

  async function handleToggleActive(endpoint: WebhookEndpointItem) {
    if (!orgId) return
    try {
      await api.patch(`/orgs/${orgId}/webhooks/${endpoint.id}`, { active: !endpoint.active })
      await load()
    } catch {
      alert('Failed to update webhook endpoint.')
    }
  }

  async function handleDelete(id: string) {
    if (!orgId) return
    setDeleting(true)
    try {
      await api.delete(`/orgs/${orgId}/webhooks/${id}`)
      setEndpoints((prev) => prev.filter((e) => e.id !== id))
    } catch {
      alert('Failed to delete webhook endpoint.')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  async function handleRegenerate(id: string) {
    if (!orgId) return
    setRegenerating(true)
    try {
      const { data } = await api.post(`/orgs/${orgId}/webhooks/${id}/regenerate-secret`)
      setRegenSecret(data.secret)
    } catch {
      alert('Failed to regenerate secret.')
    } finally {
      setRegenerating(false)
      setRegenTarget(null)
    }
  }

  if (!orgId) {
    return <p className="text-sm text-muted-foreground">Switch to an organization to manage its webhooks.</p>
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {newSecret && (
        <div className="rounded-lg border border-green-500 bg-green-50 dark:bg-green-950 p-4 space-y-2">
          <p className="text-xs font-semibold text-green-800 dark:text-green-200">
            Webhook secret created — copy it now. It won't be shown again.
          </p>
          <code className="block text-xs font-mono break-all text-green-700 dark:text-green-300 bg-white dark:bg-black rounded p-2">
            {newSecret}
          </code>
          <Button size="sm" variant="outline"
            onClick={() => { void navigator.clipboard.writeText(newSecret); setNewSecret(null) }}>
            Copy & Dismiss
          </Button>
        </div>
      )}

      {regenSecret && (
        <div className="rounded-lg border border-green-500 bg-green-50 dark:bg-green-950 p-4 space-y-2">
          <p className="text-xs font-semibold text-green-800 dark:text-green-200">
            Secret regenerated — copy it now. The old secret no longer works.
          </p>
          <code className="block text-xs font-mono break-all text-green-700 dark:text-green-300 bg-white dark:bg-black rounded p-2">
            {regenSecret}
          </code>
          <Button size="sm" variant="outline"
            onClick={() => { void navigator.clipboard.writeText(regenSecret); setRegenSecret(null) }}>
            Copy & Dismiss
          </Button>
        </div>
      )}

      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-medium">Add endpoint</p>
        <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
          placeholder="https://example.com/webhook" className="text-sm" />
        <div className="flex flex-wrap gap-3">
          {WEBHOOK_EVENTS.map((event) => (
            <label key={event} className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={newEvents.includes(event)} onChange={() => toggleEvent(event)} />
              {event}
            </label>
          ))}
        </div>
        <Button size="sm" onClick={() => void handleCreate()} disabled={creating || !newUrl.trim() || newEvents.length === 0}>
          {creating ? '…' : 'Create endpoint'}
        </Button>
      </div>

      {loading
        ? <p className="text-sm text-muted-foreground">Loading…</p>
        : endpoints.length === 0
          ? <p className="text-sm text-muted-foreground">No webhook endpoints yet.</p>
          : (
            <div className="space-y-2">
              {endpoints.map((endpoint) => (
                <div key={endpoint.id} className="space-y-2">
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <code className="text-xs break-all">{endpoint.url}</code>
                      <Badge variant={endpoint.active ? 'default' : 'secondary'}>{endpoint.active ? 'active' : 'inactive'}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {endpoint.events.map((e) => <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>)}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => void handleToggleActive(endpoint)}>
                        {endpoint.active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setExpanded(expanded === endpoint.id ? null : endpoint.id)}>
                        {expanded === endpoint.id ? 'Hide deliveries' : 'View deliveries'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setRegenTarget(endpoint.id)}>
                        Regenerate secret
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(endpoint.id)}>Delete</Button>
                    </div>
                  </div>

                  {expanded === endpoint.id && (
                    <DeliveriesPanel orgId={orgId} webhookId={endpoint.id} onClose={() => setExpanded(null)} />
                  )}
                </div>
              ))}
            </div>
          )
      }

      <ConfirmDialog open={!!deleteTarget} title="Delete webhook endpoint"
        message="Delete this webhook endpoint? This cannot be undone."
        danger loading={deleting} onConfirm={() => { if (deleteTarget) void handleDelete(deleteTarget) }}
        onCancel={() => setDeleteTarget(null)} />

      <ConfirmDialog open={!!regenTarget} title="Regenerate secret"
        message="Regenerate this endpoint's secret? The old secret will stop working immediately."
        danger loading={regenerating} onConfirm={() => { if (regenTarget) void handleRegenerate(regenTarget) }}
        onCancel={() => setRegenTarget(null)} />
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

type Tab = 'orgs' | 'webhooks'

export default function UserOrganizationsPage() {
  const [tab, setTab] = useState<Tab>('orgs')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'orgs',     label: 'My Organizations' },
    { key: 'webhooks', label: 'Webhooks' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organizations</h1>
        <p className="text-sm text-muted-foreground">Switch between your organization memberships and manage webhooks.</p>
      </div>

      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-[--role-accent] text-[--role-accent]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'orgs'     && <MyOrgsTab />}
      {tab === 'webhooks' && <WebhooksTab />}
    </div>
  )
}
