import { useEffect, useState } from 'react'
import api from '@/lib/axios'
import { Badge } from '@/components/ui/badge'

interface Permission {
  id: string; slug: string; name: string; mainGroup: string; isProtected: boolean
}

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    api.get('/admin/permissions')
      .then(({ data }) => setPermissions(data.permissions))
      .finally(() => setLoading(false))
  }, [])

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    ;(acc[p.mainGroup] ??= []).push(p)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Permissions</h1>
        <p className="text-sm text-muted-foreground">
          {permissions.length} permissions across {Object.keys(grouped).length} groups
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(grouped).map(([group, perms]) => (
            <div key={group} className="rounded-xl border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </h3>
              <ul className="space-y-1.5">
                {perms.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <code className="text-xs text-muted-foreground">{p.slug}</code>
                    </div>
                    {p.isProtected && <Badge variant="outline" className="shrink-0">Protected</Badge>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
