import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'
import { Badge }  from '@/components/ui/badge'

interface LoginConfigItem {
  id:                string | null
  roleId:            string
  roleName:          string
  roleSlug:          string
  template:          'modal' | 'centered' | 'split'
  bgImage:           string | null
  logoUrl:           string | null
  brandTitle:        string
  brandSubtitle:     string | null
  googleAuthEnabled: boolean
}

const TEMPLATES: Array<{ value: 'centered' | 'modal' | 'split'; label: string; desc: string }> = [
  { value: 'centered', label: 'Centered',  desc: 'Card centred on page with optional bg image' },
  { value: 'modal',    label: 'Modal',     desc: 'Frosted-glass overlay with blurred backdrop' },
  { value: 'split',    label: 'Split',     desc: 'Left brand panel + right form' },
]

function ConfigCard({
  config,
  onSave,
}: {
  config: LoginConfigItem
  onSave: (roleId: string, data: Partial<LoginConfigItem>) => Promise<void>
}) {
  const [template,          setTemplate]          = useState(config.template)
  const [bgImage,           setBgImage]           = useState(config.bgImage ?? '')
  const [logoUrl,           setLogoUrl]           = useState(config.logoUrl ?? '')
  const [brandTitle,        setBrandTitle]        = useState(config.brandTitle)
  const [brandSubtitle,     setBrandSubtitle]     = useState(config.brandSubtitle ?? '')
  const [googleAuthEnabled, setGoogleAuthEnabled] = useState(config.googleAuthEnabled)
  const [saving,            setSaving]            = useState(false)
  const [saved,             setSaved]             = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(config.roleId, {
        template,
        bgImage:           bgImage    || null,
        logoUrl:           logoUrl    || null,
        brandTitle:        brandTitle || 'Sign in',
        brandSubtitle:     brandSubtitle || null,
        googleAuthEnabled,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{config.roleName}</h3>
          <code className="text-xs text-muted-foreground">/login/{config.roleSlug}</code>
        </div>
        <Badge variant="outline">{template}</Badge>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Template</Label>
          <div className="flex gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTemplate(t.value)}
                className={`flex-1 rounded-lg border p-2 text-xs transition-colors ${
                  template === t.value
                    ? 'border-[--role-accent] bg-[--role-accent]/10 font-medium'
                    : 'hover:bg-accent'
                }`}
              >
                <div className="font-medium">{t.label}</div>
                <div className="text-muted-foreground mt-0.5">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Brand Title</Label>
            <Input value={brandTitle} onChange={(e) => setBrandTitle(e.target.value)} placeholder="Sign in" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Brand Subtitle</Label>
            <Input value={brandSubtitle} onChange={(e) => setBrandSubtitle(e.target.value)} placeholder="Optional tagline" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Background Image URL</Label>
            <Input value={bgImage} onChange={(e) => setBgImage(e.target.value)} placeholder="https://…" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Logo URL</Label>
            <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={googleAuthEnabled}
            onChange={(e) => setGoogleAuthEnabled(e.target.checked)}
            className="rounded"
          />
          Enable "Continue with Google" button
        </label>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

export default function LoginPagesPage() {
  const [configs,  setConfigs]  = useState<LoginConfigItem[]>([])
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    const { data } = await api.get('/admin/login-configs')
    setConfigs(data.configs)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleSave(roleId: string, data: Partial<LoginConfigItem>) {
    const res = await api.put(`/admin/login-configs/${roleId}`, data)
    setConfigs((prev) => prev.map((c) => c.roleId === roleId ? { ...c, ...res.data.config } : c))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Login Pages</h1>
        <p className="text-sm text-muted-foreground">Configure the login page for each role portal</p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {configs.map((config) => (
            <ConfigCard key={config.roleId} config={config} onSave={handleSave} />
          ))}
        </div>
      )}
    </div>
  )
}
