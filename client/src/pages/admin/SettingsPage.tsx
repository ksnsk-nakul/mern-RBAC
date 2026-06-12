import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/axios'
import { Button }  from '@/components/ui/button'
import { Input }   from '@/components/ui/input'
import { Label }   from '@/components/ui/label'
import { Badge }   from '@/components/ui/badge'

interface SettingItem {
  id:       string
  group:    string
  name:     string
  slug:     string
  value:    unknown
  type:     string
  options:  string[]
  isPublic: boolean
}

function SettingInput({
  setting,
  onChange,
}: {
  setting: SettingItem
  onChange: (slug: string, value: unknown) => void
}) {
  const val = setting.value

  switch (setting.type) {
    case 'boolean':
      return (
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(val)}
            onChange={(e) => onChange(setting.slug, e.target.checked)}
            className="h-4 w-4 rounded"
          />
          <span className="text-sm">{val ? 'Enabled' : 'Disabled'}</span>
        </label>
      )
    case 'number':
      return (
        <Input
          type="number"
          value={String(val ?? '')}
          onChange={(e) => onChange(setting.slug, Number(e.target.value))}
          className="max-w-xs"
        />
      )
    case 'select':
      return (
        <select
          value={String(val ?? '')}
          onChange={(e) => onChange(setting.slug, e.target.value)}
          className="flex h-10 max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--role-accent]"
        >
          {setting.options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )
    case 'color':
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={String(val ?? '#000000')}
            onChange={(e) => onChange(setting.slug, e.target.value)}
            className="h-10 w-10 cursor-pointer rounded border"
          />
          <Input
            value={String(val ?? '')}
            onChange={(e) => onChange(setting.slug, e.target.value)}
            className="max-w-xs"
            placeholder="#000000"
          />
        </div>
      )
    default: // string, image
      return (
        <Input
          value={String(val ?? '')}
          onChange={(e) => onChange(setting.slug, e.target.value)}
          className="max-w-sm"
        />
      )
  }
}

export default function SettingsPage() {
  const [grouped,  setGrouped]  = useState<Record<string, SettingItem[]>>({})
  const [dirty,    setDirty]    = useState<Record<string, unknown>>({})
  const [saving,   setSaving]   = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    const { data } = await api.get('/admin/settings')
    setGrouped(data.settings)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  function handleChange(slug: string, value: unknown) {
    setDirty((prev) => ({ ...prev, [slug]: value }))
    setGrouped((prev) => {
      const next = { ...prev }
      for (const group of Object.keys(next)) {
        next[group] = next[group].map((s) =>
          s.slug === slug ? { ...s, value } : s,
        )
      }
      return next
    })
  }

  async function handleSave(slug: string) {
    if (!(slug in dirty)) return
    setSaving(slug)
    try {
      await api.patch(`/admin/settings/${slug}`, { value: dirty[slug] })
      setDirty((prev) => {
        const next = { ...prev }
        delete next[slug]
        return next
      })
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Application configuration</p>
      </div>

      {Object.entries(grouped).map(([group, settings]) => (
        <div key={group} className="space-y-4">
          <h2 className="text-base font-semibold capitalize border-b pb-1">{group.replace('_', ' ')}</h2>
          <div className="space-y-4">
            {settings.map((s) => (
              <div key={s.slug} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 sm:w-64">
                  <Label className="text-sm font-medium">{s.name}</Label>
                  <p className="text-xs text-muted-foreground font-mono">{s.slug}</p>
                </div>
                <div className="flex flex-1 items-center gap-2">
                  <SettingInput setting={s} onChange={handleChange} />
                  {s.isPublic && (
                    <Badge variant="outline" className="shrink-0 text-xs">Public</Badge>
                  )}
                  <Button
                    size="sm"
                    variant={dirty[s.slug] !== undefined ? 'default' : 'outline'}
                    disabled={!(s.slug in dirty) || saving === s.slug}
                    onClick={() => void handleSave(s.slug)}
                    className="shrink-0"
                  >
                    {saving === s.slug ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
