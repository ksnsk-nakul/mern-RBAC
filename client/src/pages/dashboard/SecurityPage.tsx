import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Badge }  from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

interface MfaStatus  { enabled: boolean; codesRemaining: number }
interface DeviceItem { id: string; label: string; lastIp: string; expiresAt: string }
interface TokenItem  { id: string; name: string; prefix: string; scopes: string[]; lastUsedAt: string | null; expiresAt: string | null }

// ─── MFA Tab ──────────────────────────────────────────────────────────────────

function MfaTab() {
  const [status,   setStatus]   = useState<MfaStatus | null>(null)
  const [qr,       setQr]       = useState<string | null>(null)
  const [secret,   setSecret]   = useState<string | null>(null)
  const [codes,    setCodes]    = useState<string[]>([])
  const [totpCode, setTotpCode] = useState('')
  const [busy,     setBusy]     = useState(false)

  const loadStatus = useCallback(async () => {
    const { data } = await api.get('/auth/mfa/status')
    setStatus(data)
  }, [])

  useEffect(() => { void loadStatus() }, [loadStatus])

  async function startSetup() {
    setBusy(true)
    try {
      const { data } = await api.post('/auth/mfa/setup')
      setQr(data.qrCodeDataUrl)
      setSecret(data.secret)
      setCodes(data.recoveryCodes)
    } finally { setBusy(false) }
  }

  async function confirmEnable() {
    if (totpCode.length !== 6) return
    setBusy(true)
    try {
      await api.post('/auth/mfa/enable', { totpCode })
      setQr(null); setSecret(null); setTotpCode('')
      await loadStatus()
    } finally { setBusy(false) }
  }

  async function handleDisable() {
    if (totpCode.length !== 6) return
    setBusy(true)
    try {
      await api.post('/auth/mfa/disable', { totpCode })
      setTotpCode('')
      await loadStatus()
    } finally { setBusy(false) }
  }

  if (!status) return <p className="text-sm text-muted-foreground">Loading…</p>

  if (status.enabled) {
    return (
      <div className="space-y-4 max-w-md">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">MFA Enabled</Badge>
          <span className="text-xs text-muted-foreground">{status.codesRemaining} recovery codes remaining</span>
        </div>
        <div className="space-y-2">
          <p className="text-sm">Enter your 6-digit code to disable MFA:</p>
          <div className="flex gap-2">
            <Input type="text" inputMode="numeric" maxLength={6} placeholder="123456"
              value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              className="max-w-xs" />
            <Button variant="destructive" size="sm" onClick={handleDisable}
              disabled={busy || totpCode.length !== 6}>
              {busy ? '…' : 'Disable MFA'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (qr) {
    return (
      <div className="space-y-4 max-w-md">
        <p className="text-sm">Scan this QR code with Google Authenticator or Authy:</p>
        <img src={qr} alt="MFA QR Code" className="w-48 h-48 rounded border" />
        {secret && (
          <p className="text-xs text-muted-foreground">
            Manual entry: <code className="font-mono bg-muted px-1 rounded">{secret}</code>
          </p>
        )}
        {codes.length > 0 && (
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <p className="text-xs font-semibold">Recovery Codes — save these now, shown once:</p>
            <div className="grid grid-cols-2 gap-1">
              {codes.map((c) => <code key={c} className="text-xs font-mono">{c}</code>)}
            </div>
          </div>
        )}
        <div className="space-y-1">
          <p className="text-sm">Enter the 6-digit code to confirm:</p>
          <div className="flex gap-2">
            <Input type="text" inputMode="numeric" maxLength={6} placeholder="123456"
              value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              className="max-w-xs" autoFocus />
            <Button size="sm" onClick={confirmEnable} disabled={busy || totpCode.length !== 6}>
              {busy ? '…' : 'Verify & Enable'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 max-w-md">
      <p className="text-sm text-muted-foreground">
        Add two-factor authentication. You'll need Google Authenticator or Authy.
      </p>
      <Button size="sm" onClick={startSetup} disabled={busy}>{busy ? '…' : 'Set up MFA'}</Button>
    </div>
  )
}

// ─── Devices Tab ──────────────────────────────────────────────────────────────

function DevicesTab() {
  const [devices,      setDevices]      = useState<DeviceItem[]>([])
  const [loading,      setLoading]      = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [clearAll,     setClearAll]     = useState(false)

  const load = useCallback(async () => {
    const { data } = await api.get('/auth/devices')
    setDevices(data.devices)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleRevoke(id: string) {
    await api.delete(`/auth/devices/${id}`)
    setDevices((prev) => prev.filter((d) => d.id !== id))
    setDeleteTarget(null)
  }

  async function handleRevokeAll() {
    await api.delete('/auth/devices/all')
    setDevices([])
    setClearAll(false)
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{devices.length} trusted device{devices.length !== 1 ? 's' : ''}</p>
        {devices.length > 0 && (
          <Button size="sm" variant="destructive" onClick={() => setClearAll(true)}>Revoke All</Button>
        )}
      </div>

      {devices.length === 0
        ? <p className="text-sm text-muted-foreground">No trusted devices.</p>
        : devices.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{d.label}</p>
              <p className="text-xs text-muted-foreground">
                Last IP: {d.lastIp} · Expires: {new Date(d.expiresAt).toLocaleDateString()}
              </p>
            </div>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
              onClick={() => setDeleteTarget(d.id)}>Revoke</Button>
          </div>
        ))
      }

      <ConfirmDialog open={!!deleteTarget} title="Revoke device"
        message="Remove this trusted device? You'll need MFA on next login from it."
        danger onConfirm={() => deleteTarget && void handleRevoke(deleteTarget)}
        onCancel={() => setDeleteTarget(null)} />

      <ConfirmDialog open={clearAll} title="Revoke all devices"
        message="Remove all trusted devices? Future logins will require MFA."
        danger onConfirm={handleRevokeAll} onCancel={() => setClearAll(false)} />
    </div>
  )
}

// ─── API Tokens Tab ───────────────────────────────────────────────────────────

function ApiTokensTab() {
  const [tokens,       setTokens]   = useState<TokenItem[]>([])
  const [loading,      setLoading]  = useState(true)
  const [newName,      setNewName]  = useState('')
  const [creating,     setCreating] = useState(false)
  const [newRaw,       setNewRaw]   = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await api.get('/auth/api-tokens')
    setTokens(data.tokens)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const { data } = await api.post('/auth/api-tokens', { name: newName.trim(), scopes: ['*'] })
      setNewRaw(data.token.rawToken)
      setNewName('')
      await load()
    } finally { setCreating(false) }
  }

  async function handleRevoke(id: string) {
    await api.delete(`/auth/api-tokens/${id}`)
    setTokens((prev) => prev.filter((t) => t.id !== id))
    setDeleteTarget(null)
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-4">
      {newRaw && (
        <div className="rounded-lg border border-green-500 bg-green-50 dark:bg-green-950 p-4 space-y-2">
          <p className="text-xs font-semibold text-green-800 dark:text-green-200">
            Token created — copy it now. It won't be shown again.
          </p>
          <code className="block text-xs font-mono break-all text-green-700 dark:text-green-300 bg-white dark:bg-black rounded p-2">
            {newRaw}
          </code>
          <Button size="sm" variant="outline"
            onClick={() => { void navigator.clipboard.writeText(newRaw); setNewRaw(null) }}>
            Copy & Dismiss
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)}
          placeholder="Token name e.g. CI/CD Pipeline" className="max-w-sm" />
        <Button size="sm" onClick={handleCreate} disabled={creating || !newName.trim()}>
          {creating ? '…' : 'Create Token'}
        </Button>
      </div>

      {tokens.length === 0
        ? <p className="text-sm text-muted-foreground">No active API tokens.</p>
        : tokens.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{t.name}</p>
              <code className="text-xs text-muted-foreground font-mono">{t.prefix}…</code>
              {t.lastUsedAt && (
                <span className="ml-2 text-xs text-muted-foreground">
                  Last used: {new Date(t.lastUsedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
              onClick={() => setDeleteTarget(t.id)}>Revoke</Button>
          </div>
        ))
      }

      <ConfirmDialog open={!!deleteTarget} title="Revoke API token"
        message="Revoke this token? Applications using it will stop working immediately."
        danger onConfirm={() => deleteTarget && void handleRevoke(deleteTarget)}
        onCancel={() => setDeleteTarget(null)} />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'mfa' | 'devices' | 'tokens'

export default function UserSecurityPage() {
  const [tab, setTab] = useState<Tab>('mfa')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'mfa',     label: 'Two-Factor Auth' },
    { key: 'devices', label: 'Trusted Devices' },
    { key: 'tokens',  label: 'API Tokens' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Security</h1>
        <p className="text-sm text-muted-foreground">Manage your account security settings</p>
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

      {tab === 'mfa'     && <MfaTab />}
      {tab === 'devices' && <DevicesTab />}
      {tab === 'tokens'  && <ApiTokensTab />}
    </div>
  )
}
