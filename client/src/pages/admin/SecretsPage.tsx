import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Badge }  from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { usePermission } from '@/hooks/usePermission'

interface SecretItem {
  id:        string
  group:     string
  name:      string
  slug:      string
  isSet:     boolean
  updatedAt: string | null
}

function groupFromSlug(slug: string): string {
  return slug.split('.')[0] ?? ''
}

function SecretRow({
  secret,
  onUpdate,
  onClear,
}: {
  secret:   SecretItem
  onUpdate: (slug: string, value: string) => Promise<void>
  onClear:  (slug: string) => Promise<void>
}) {
  const { hasPermission }  = usePermission()
  const group              = groupFromSlug(secret.slug)
  const canView            = hasPermission(`secrets.${group}.view`) || hasPermission('*')
  const canManage          = hasPermission(`secrets.${group}.manage`) || hasPermission('*')

  const [revealing,     setRevealing]     = useState(false)
  const [revealed,      setRevealed]      = useState<string | null>(null)
  const [revealSeconds, setRevealSeconds] = useState(0)
  const [editMode,      setEditMode]      = useState(false)
  const [newValue,      setNewValue]      = useState('')
  const [saving,        setSaving]        = useState(false)
  const [clearTarget,   setClearTarget]   = useState(false)

  useEffect(() => {
    if (!revealed) return
    setRevealSeconds(30)
    const tick = setInterval(() => {
      setRevealSeconds((s) => {
        if (s <= 1) { clearInterval(tick); setRevealed(null); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [revealed])

  async function handleReveal() {
    setRevealing(true)
    try {
      const { data } = await api.get(`/admin/secrets/${secret.slug}/reveal`)
      setRevealed(data.value)
    } finally {
      setRevealing(false)
    }
  }

  async function handleSave() {
    if (!newValue.trim()) return
    setSaving(true)
    try {
      await onUpdate(secret.slug, newValue)
      setEditMode(false)
      setNewValue('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{secret.name}</span>
          {secret.isSet
            ? <Badge variant="secondary" className="text-xs">✓ Configured</Badge>
            : <Badge variant="outline" className="text-xs text-muted-foreground">⚠ Not set</Badge>
          }
        </div>
        <code className="text-xs text-muted-foreground">{secret.slug}</code>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {revealed && (
          <div className="flex items-center gap-1">
            <Input
              readOnly
              value={revealed}
              className="h-8 w-48 font-mono text-xs"
            />
            <span className="text-xs text-muted-foreground">{revealSeconds}s</span>
          </div>
        )}

        {editMode ? (
          <div className="flex items-center gap-1">
            <Input
              type="password"
              placeholder="New value…"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="h-8 w-40 text-xs"
              autoFocus
            />
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? '…' : 'Save'}</Button>
            <Button size="sm" variant="outline" onClick={() => { setEditMode(false); setNewValue('') }}>Cancel</Button>
          </div>
        ) : (
          <>
            {canView && secret.isSet && !revealed && (
              <Button size="sm" variant="outline" onClick={handleReveal} disabled={revealing}>
                {revealing ? '…' : 'Reveal'}
              </Button>
            )}
            {canManage && (
              <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                {secret.isSet ? 'Update' : 'Set'}
              </Button>
            )}
            {canManage && secret.isSet && (
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setClearTarget(true)}>
                Clear
              </Button>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={clearTarget}
        title="Clear secret"
        message={`Clear "${secret.name}"? The value will be permanently removed.`}
        danger
        onConfirm={() => { setClearTarget(false); void onClear(secret.slug) }}
        onCancel={() => setClearTarget(false)}
      />
    </div>
  )
}

export default function SecretsPage() {
  const [grouped,  setGrouped]  = useState<Record<string, SecretItem[]>>({})
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    const { data } = await api.get('/admin/secrets')
    setGrouped(data.secrets)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleUpdate(slug: string, value: string) {
    await api.put(`/admin/secrets/${slug}`, { value })
    await load()
  }

  async function handleClear(slug: string) {
    await api.delete(`/admin/secrets/${slug}`)
    await load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Secrets</h1>
        <p className="text-sm text-muted-foreground">
          Encrypted credentials. Reveal actions are audit-logged.
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        Object.entries(grouped).map(([group, secrets]) => (
          <div key={group} className="space-y-2">
            <h2 className="text-base font-semibold capitalize">{group}</h2>
            <div className="space-y-2">
              {secrets.map((s) => (
                <SecretRow
                  key={s.slug}
                  secret={s}
                  onUpdate={handleUpdate}
                  onClear={handleClear}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
