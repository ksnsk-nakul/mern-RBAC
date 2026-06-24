import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'

interface Permission {
  id: string; slug: string; name: string; mainGroup: string
}

interface RoleFormData {
  name:               string
  route:              string
  color:              string
  isSubAdmin:         boolean
  mfaRequired:        boolean
  requireIpAllowlist: boolean
  permissionIds:      string[]
}

interface Props {
  open:           boolean
  initialData?:   RoleFormData & { id?: string; slug?: string; isProtected?: boolean }
  allPermissions: Permission[]
  templates?:     { id: string; name: string; permissionIds: string[] }[]
  onSave:         (data: RoleFormData & { slug?: string }) => Promise<void>
  onClose:        () => void
  isCreate?:      boolean
}

function groupByMainGroup(perms: Permission[]): Map<string, Permission[]> {
  const map = new Map<string, Permission[]>()
  for (const p of perms) {
    if (!map.has(p.mainGroup)) map.set(p.mainGroup, [])
    map.get(p.mainGroup)!.push(p)
  }
  return map
}

export function RoleEditModal({ open, initialData, allPermissions, templates, onSave, onClose, isCreate }: Props) {
  const [name,               setName]               = useState(initialData?.name ?? '')
  const [slug,               setSlug]               = useState(initialData?.slug ?? '')
  const [route,              setRoute]              = useState(initialData?.route ?? '')
  const [color,              setColor]              = useState(initialData?.color ?? '#6366f1')
  const [isSubAdmin,         setIsSubAdmin]         = useState(initialData?.isSubAdmin ?? false)
  const [mfaRequired,        setMfaRequired]        = useState(initialData?.mfaRequired ?? false)
  const [requireIpAllowlist, setRequireIpAllowlist] = useState(initialData?.requireIpAllowlist ?? false)
  const [permissionIds,      setPermissionIds]      = useState<string[]>(initialData?.permissionIds ?? [])
  const [saving,             setSaving]             = useState(false)
  const [error,              setError]              = useState('')

  useEffect(() => {
    if (initialData) {
      setName(initialData.name ?? '')
      setSlug(initialData.slug ?? '')
      setRoute(initialData.route ?? '')
      setColor(initialData.color ?? '#6366f1')
      setIsSubAdmin(initialData.isSubAdmin ?? false)
      setMfaRequired(initialData.mfaRequired ?? false)
      setRequireIpAllowlist(initialData.requireIpAllowlist ?? false)
      setPermissionIds(initialData.permissionIds ?? [])
    }
  }, [initialData])

  function togglePermission(id: string) {
    setPermissionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function applyTemplate(templateId: string) {
    const template = templates?.find((t) => t.id === templateId)
    if (template) setPermissionIds(template.permissionIds)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave({ name, slug: isCreate ? slug : undefined, route, color, isSubAdmin, mfaRequired, requireIpAllowlist, permissionIds })
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const grouped = groupByMainGroup(allPermissions)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border bg-card p-6 shadow-xl">
        <h2 className="text-xl font-semibold">{isCreate ? 'Create Role' : 'Edit Role'}</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            {isCreate && (
              <div className="space-y-1">
                <Label>Slug</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. viewer" required />
              </div>
            )}
            <div className="space-y-1">
              <Label>Route</Label>
              <Input value={route} onChange={(e) => setRoute(e.target.value)} placeholder="e.g. viewer" required />
            </div>
            <div className="space-y-1">
              <Label>Accent Color</Label>
              <div className="flex gap-2">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded border" />
                <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#6366f1" className="flex-1" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            {([
              { label: 'Sub-Admin',   value: isSubAdmin,          setter: setIsSubAdmin },
              { label: 'MFA Required', value: mfaRequired,        setter: setMfaRequired },
              { label: 'IP Allowlist', value: requireIpAllowlist, setter: setRequireIpAllowlist },
            ] as const).map(({ label, value, setter }) => (
              <label key={label} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={value} onChange={(e) => setter(e.target.checked)} className="rounded" />
                {label}
              </label>
            ))}
          </div>

          {templates && templates.length > 0 && (
            <div className="space-y-1">
              <Label>Use template</Label>
              <select
                defaultValue=""
                onChange={(e) => { if (e.target.value) applyTemplate(e.target.value) }}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">— Select a template to pre-fill permissions —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.permissionIds.length} permissions)</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label className="mb-2 block">Permissions</Label>
            <div className="max-h-64 overflow-y-auto rounded-lg border p-3 space-y-4">
              {Array.from(grouped.entries()).map(([group, perms]) => (
                <div key={group}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {perms.map((p) => (
                      <label key={p.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={permissionIds.includes(p.id)}
                          onChange={() => togglePermission(p.id)}
                          className="rounded"
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
