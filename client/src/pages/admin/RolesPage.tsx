import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/axios'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { RoleEditModal } from './components/RoleEditModal'

interface Permission {
  id: string; slug: string; name: string; mainGroup: string
}

interface RoleTemplateItem {
  id: string; name: string; description?: string; permissionIds: string[]
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
  const [templates,            setTemplates]            = useState<RoleTemplateItem[]>([])
  const [newTemplateName,      setNewTemplateName]      = useState('')
  const [newTemplatePerms,     setNewTemplatePerms]     = useState<string[]>([])
  const [creatingTemplate,     setCreatingTemplate]     = useState(false)
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<RoleTemplateItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rolesRes, permsRes, templatesRes] = await Promise.all([
        api.get('/admin/roles'),
        api.get('/admin/permissions'),
        api.get('/admin/roles/templates'),
      ])
      setRoles(rolesRes.data.roles)
      setAllPerms(permsRes.data.permissions)
      setTemplates(templatesRes.data.templates)
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

  function toggleTemplatePerm(id: string) {
    setNewTemplatePerms((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleCreateTemplate() {
    if (!newTemplateName.trim() || newTemplatePerms.length === 0) return
    setCreatingTemplate(true)
    try {
      await api.post('/admin/roles/templates', { name: newTemplateName.trim(), permissionIds: newTemplatePerms })
      setNewTemplateName('')
      setNewTemplatePerms([])
      await load()
    } catch {
      alert('Failed to create template.')
    } finally {
      setCreatingTemplate(false)
    }
  }

  async function handleDeleteTemplate(template: RoleTemplateItem) {
    try {
      await api.delete(`/admin/roles/templates/${template.id}`)
      setTemplates((prev) => prev.filter((t) => t.id !== template.id))
    } catch {
      alert('Failed to delete template.')
    } finally {
      setDeleteTemplateTarget(null)
    }
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
        templates={templates}
        onSave={handleSave}
        onClose={() => setEditTarget(null)}
      />

      <RoleEditModal
        open={creating}
        allPermissions={allPerms}
        templates={templates}
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

      <div className="rounded-lg border p-4 space-y-3 mt-6">
        <div>
          <h2 className="text-lg font-semibold">Role Templates</h2>
          <p className="text-sm text-muted-foreground">Predefined permission sets for quick role creation.</p>
        </div>

        {templates.length === 0
          ? <p className="text-sm text-muted-foreground">No templates yet.</p>
          : (
            <div className="space-y-1">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border p-2">
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.permissionIds.length} permissions</p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTemplateTarget(t)}>Delete</Button>
                </div>
              ))}
            </div>
          )
        }

        <div className="space-y-2 border-t pt-3">
          <p className="text-sm font-medium">Create template</p>
          <Input value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="Template name" className="max-w-sm" />
          <div className="max-h-48 overflow-y-auto rounded-lg border p-2 grid grid-cols-2 gap-1">
            {allPerms.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={newTemplatePerms.includes(p.id)} onChange={() => toggleTemplatePerm(p.id)} className="rounded" />
                {p.name}
              </label>
            ))}
          </div>
          <Button size="sm" onClick={() => void handleCreateTemplate()} disabled={creatingTemplate || !newTemplateName.trim() || newTemplatePerms.length === 0}>
            {creatingTemplate ? '…' : 'Create template'}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTemplateTarget}
        title="Delete role template"
        message={`Delete the "${deleteTemplateTarget?.name}" template? This does not affect roles already created from it.`}
        danger
        onConfirm={() => deleteTemplateTarget && void handleDeleteTemplate(deleteTemplateTarget)}
        onCancel={() => setDeleteTemplateTarget(null)}
      />
    </div>
  )
}
