import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Badge }  from '@/components/ui/badge'
import { Input }  from '@/components/ui/input'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityLogItem {
  id: string; action: string; actorEmail?: string
  targetType?: string; targetId?: string; targetName?: string
  hash: string; prevHash: string; createdAt: string
}

interface LoginLogItem {
  id: string; ip: string; userAgent: string; roleSlug: string
  success: boolean; failReason?: string; createdAt: string
}

interface PaginatedResponse<T> {
  logs: T[]; total: number; pages: number
}

// ─── Activity Tab ─────────────────────────────────────────────────────────────

function ActivityTab() {
  const [logs,    setLogs]    = useState<ActivityLogItem[]>([])
  const [page,    setPage]    = useState(1)
  const [pages,   setPages]   = useState(1)
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [chainOk, setChainOk] = useState<boolean | null>(null)

  const load = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const { data } = await api.get<PaginatedResponse<ActivityLogItem>>(`/admin/logs/activity?page=${p}&limit=25`)
      setLogs(data.logs); setPage(p); setPages(data.pages); setTotal(data.total)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load(1) }, [load])

  async function checkIntegrity() {
    const { data } = await api.get<{ valid: boolean; brokenAt?: number }>('/admin/logs/integrity')
    setChainOk(data.valid)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{total} events</span>
        <div className="flex gap-2">
          {chainOk !== null && (
            <Badge variant={chainOk ? 'secondary' : 'destructive'}>
              {chainOk ? 'Chain valid' : 'Chain BROKEN'}
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => void checkIntegrity()}>Verify integrity</Button>
        </div>
      </div>

      {loading
        ? <p className="text-sm text-muted-foreground">Loading…</p>
        : logs.length === 0
          ? <p className="text-sm text-muted-foreground">No activity yet.</p>
          : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Action</th>
                    <th className="px-3 py-2 text-left font-medium">Actor</th>
                    <th className="px-3 py-2 text-left font-medium">Target</th>
                    <th className="px-3 py-2 text-left font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-t hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono">{l.action}</td>
                      <td className="px-3 py-2 text-muted-foreground">{l.actorEmail ?? '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {l.targetType && <span className="mr-1 text-foreground">{l.targetType}</span>}
                        {l.targetName ?? l.targetId ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {new Date(l.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      }

      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" onClick={() => void load(page - 1)} disabled={page <= 1}>Previous</Button>
        <span className="text-xs text-muted-foreground">Page {page} of {pages}</span>
        <Button size="sm" variant="outline" onClick={() => void load(page + 1)} disabled={page >= pages}>Next</Button>
      </div>
    </div>
  )
}

// ─── Login Tab ────────────────────────────────────────────────────────────────

function LoginTab() {
  const [logs,    setLogs]    = useState<LoginLogItem[]>([])
  const [page,    setPage]    = useState(1)
  const [pages,   setPages]   = useState(1)
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<'all' | 'success' | 'fail'>('all')

  const load = useCallback(async (p: number, f: typeof filter) => {
    setLoading(true)
    try {
      const successParam = f === 'success' ? '&success=true' : f === 'fail' ? '&success=false' : ''
      const { data } = await api.get<PaginatedResponse<LoginLogItem>>(
        `/admin/logs/login?page=${p}&limit=25${successParam}`,
      )
      setLogs(data.logs); setPage(p); setPages(data.pages); setTotal(data.total)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load(1, filter) }, [load, filter])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{total} attempts</span>
        <div className="flex gap-1 ml-auto">
          {(['all', 'success', 'fail'] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'}
              onClick={() => { setFilter(f) }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {loading
        ? <p className="text-sm text-muted-foreground">Loading…</p>
        : logs.length === 0
          ? <p className="text-sm text-muted-foreground">No login attempts.</p>
          : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">IP</th>
                    <th className="px-3 py-2 text-left font-medium">Role</th>
                    <th className="px-3 py-2 text-left font-medium">User Agent</th>
                    <th className="px-3 py-2 text-left font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-t hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <Badge variant={l.success ? 'secondary' : 'destructive'}>
                          {l.success ? 'OK' : 'FAIL'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-mono">{l.ip}</td>
                      <td className="px-3 py-2">{l.roleSlug}</td>
                      <td className="px-3 py-2 text-muted-foreground max-w-xs truncate" title={l.userAgent}>
                        {l.userAgent.slice(0, 60)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {new Date(l.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      }

      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" onClick={() => void load(page - 1, filter)} disabled={page <= 1}>Previous</Button>
        <span className="text-xs text-muted-foreground">Page {page} of {pages}</span>
        <Button size="sm" variant="outline" onClick={() => void load(page + 1, filter)} disabled={page >= pages}>Next</Button>
      </div>
    </div>
  )
}

// ─── Export Tab ───────────────────────────────────────────────────────────────

function ExportTab() {
  const [type,      setType]      = useState<'activity' | 'login'>('activity')
  const [format,    setFormat]    = useState<'json' | 'csv'>('csv')
  const [from,      setFrom]      = useState('')
  const [to,        setTo]        = useState('')
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const params = new URLSearchParams({ type, format })
      if (from) params.set('from', from)
      if (to)   params.set('to',   to)

      const { data } = await api.get(`/admin/logs/export?${params.toString()}`, {
        responseType: format === 'csv' ? 'text' : 'json',
      })

      const blob = new Blob([format === 'csv' ? data : JSON.stringify(data, null, 2)], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${type}-logs-${new Date().toISOString().slice(0, 10)}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }

  return (
    <div className="space-y-6 max-w-md">
      <div className="space-y-2">
        <p className="text-sm font-medium">Log type</p>
        <div className="flex gap-2">
          {(['activity', 'login'] as const).map((t) => (
            <Button key={t} size="sm" variant={type === t ? 'default' : 'outline'} onClick={() => setType(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Format</p>
        <div className="flex gap-2">
          {(['csv', 'json'] as const).map((f) => (
            <Button key={f} size="sm" variant={format === f ? 'default' : 'outline'} onClick={() => setFormat(f)}>
              {f.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">From (optional)</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">To (optional)</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <Button onClick={() => void handleExport()} disabled={exporting}>
        {exporting ? 'Exporting…' : `Download ${format.toUpperCase()}`}
      </Button>

      <p className="text-xs text-muted-foreground">Up to 10,000 records. Use date filters for large datasets.</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'activity' | 'login' | 'export'

export default function ActivityLogsPage() {
  const [tab, setTab] = useState<Tab>('activity')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'activity', label: 'Activity Log' },
    { key: 'login',    label: 'Login Attempts' },
    { key: 'export',   label: 'Export' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Activity Logs</h1>
        <p className="text-sm text-muted-foreground">
          Hash-chained audit trail of all system actions.
        </p>
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

      {tab === 'activity' && <ActivityTab />}
      {tab === 'login'    && <LoginTab />}
      {tab === 'export'   && <ExportTab />}
    </div>
  )
}
