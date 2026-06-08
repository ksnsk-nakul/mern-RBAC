import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/axios'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { RoleEditModal } from './components/RoleEditModal'

interface Permission {
  id: string; slug: string; name: string; mainGroup: string
}

interface RoleRow {
  id:                 string
  name:               string
  slug:               string
  route:              string
  color:              string
  isSubAdmin:         boolean
  isDefault:          boolean
  isProtected:        boolean
  mfaRequired:        boolean
  requireIpAllowlist: boolean
  userCount:          number
  permissions:        Permission[]
}

const COLUMNS: Column<RoleRow>[] = [
  {
    key: 'name', header: 'Role',
    render: (r) => (
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: r.color }} />
        <span className="font-medium">{r.name}</span>
        <code className="text-xs text-muted-foreground">{r.slug}</code>
      </div>
    ),
  },
  {
    key: 'perms', header: 'Permissions',
    render: (r) => <span className="text-sm">{r.permissions.length}</span>,
  },
  {
    key: 'users', header: 'Users',
    render: (r) => <span className="text-sm">{r.userCount}</span>,
  },
  {
    key: 'flags', header: 'Flags',
    render: (r) => (
      <div className="flex flex-wrap gap-1">
        {r.isProtected && <Badge variant="outline">Protected</Badge>}
        {r.isDefault   && <Badge variant="secondary">Default</Badge>}
        {r.isSubAdmin  && <Badge variant="secondary">Sub-Admin</Badge>}
        {r.mfaRequired && <Badge variant="outline">MFA</Badge>}
      </div>
    ),
  },
]

export default function RolesPage() {
  const [roles,        setRoles]        = useState<RoleRow[]>([])
  const [allPerms,     setAllPerms]     = useState<Permission[]>([])
  const [loading,      setLoading]      = useState(true)
  const [editTarget,   setEditTarget]   = useState<RoleRow | null>(null)
  const [creating,     setCreating]     = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rolesRes, permsRes] = await Promise.all([
        api.get('/admin/roles'),
        api.get('/admin/permissions'),
      ])
      setRoles(rolesRes.data.roles)
      setAllPerms(permsRes.data.permissions)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleSave(data: any) {
    if (editTarget) {
      await api.patch(`/admin/roles/${editTarget.id}`, data)
    } else {
      await api.post('/admin/roles', data)
    }
    void load()
  }

  async function handleDelete(role: RoleRow) {
    await api.delete(`/admin/roles/${role.id}`)
    setDeleteTarget(null)
    void load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Roles</h1>
          <p className="text-sm text-muted-foreground">{roles.length} roles</p>
        </div>
        <Button onClick={() => setCreating(true)}>New Role</Button>
      </div>

      <DataTable
        columns={COLUMNS}
        data={roles}
        loading={loading}
        emptyText="No roles found."
        actions={(role) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEditTarget(role)}>Edit</Button>
            <Button
              variant="ghost" size="sm"
              className="text-destructive hover:text-destructive"
              disabled={role.isProtected}
              onClick={() => setDeleteTarget(role)}
            >
              Delete
            </Button>
          </div>
        )}
      />

      <RoleEditModal
        open={!!editTarget}
        initialData={editTarget ? {
          id:                 editTarget.id,
          slug:               editTarget.slug,
          name:               editTarget.name,
          route:              editTarget.route,
          color:              editTarget.color,
          isSubAdmin:         editTarget.isSubAdmin,
          mfaRequired:        editTarget.mfaRequired,
          requireIpAllowlist: editTarget.requireIpAllowlist,
          isProtected:        editTarget.isProtected,
          permissionIds:      editTarget.permissions.map((p) => p.id),
        } : undefined}
        allPermissions={allPerms}
        onSave={handleSave}
        onClose={() => setEditTarget(null)}
      />

      <RoleEditModal
        open={creating}
        allPermissions={allPerms}
        onSave={handleSave}
        onClose={() => setCreating(false)}
        isCreate
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete role"
        message={`Delete "${deleteTarget?.name}"? All users with this role will have it revoked.`}
        danger
        onConfirm={() => deleteTarget && void handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
