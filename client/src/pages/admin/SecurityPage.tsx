import { useEffect, useState } from 'react'
import api from '@/lib/axios'

interface RoleRow {
  id: string; name: string; color: string; mfaRequired: boolean
}

export default function AdminSecurityPage() {
  const [roles,   setRoles]   = useState<RoleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState<string | null>(null)

  useEffect(() => {
    api.get('/admin/roles').then(({ data }) => {
      setRoles(data.roles)
      setLoading(false)
    })
  }, [])

  async function toggle(role: RoleRow) {
    setSaving(role.id)
    try {
      await api.patch(`/admin/roles/${role.id}`, { mfaRequired: !role.mfaRequired })
      setRoles((prev) =>
        prev.map((r) => r.id === role.id ? { ...r, mfaRequired: !r.mfaRequired } : r)
      )
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Security</h1>
        <p className="text-sm text-muted-foreground">Require MFA for specific roles at login</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <div key={role.id} className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: role.color }}
                />
                <span className="font-medium text-sm">{role.name}</span>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={role.mfaRequired}
                  disabled={saving === role.id}
                  onChange={() => void toggle(role)}
                  className="rounded"
                />
                Require MFA
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
