import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/axios'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

interface Role {
  id: string; name: string; slug: string; color: string
}

interface UserRow {
  id:        string
  name:      string
  email:     string
  isFounder: boolean
  roles:     Role[]
  createdAt: string
  deletedAt: string | null
}

const COLUMNS: Column<UserRow>[] = [
  {
    key: 'name', header: 'Name',
    render: (u) => (
      <div>
        <div className="font-medium">{u.name}</div>
        <div className="text-xs text-muted-foreground">{u.email}</div>
      </div>
    ),
  },
  {
    key: 'roles', header: 'Roles',
    render: (u) => (
      <div className="flex flex-wrap gap-1">
        {u.roles.map((r) => (
          <span
            key={r.id}
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: r.color }}
          >
            {r.name}
          </span>
        ))}
        {u.roles.length === 0 && <span className="text-xs text-muted-foreground">No roles</span>}
      </div>
    ),
  },
  {
    key: 'status', header: 'Status',
    render: (u) => u.deletedAt
      ? <Badge variant="destructive">Deleted</Badge>
      : <Badge variant="secondary">Active</Badge>,
  },
  {
    key: 'founder', header: '',
    render: (u) => u.isFounder ? <Badge>Founder</Badge> : null,
  },
]

export default function UsersPage() {
  const [users,        setUsers]        = useState<UserRow[]>([])
  const [total,        setTotal]        = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [page,         setPage]         = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/users', { params: { search, page, limit: 20 } })
      setUsers(data.users)
      setTotal(data.total)
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { void load() }, [load])

  async function handleDelete(user: UserRow) {
    await api.delete(`/admin/users/${user.id}`)
    setDeleteTarget(null)
    void load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">{total} total</p>
        </div>
      </div>

      <DataTable
        columns={COLUMNS}
        data={users}
        loading={loading}
        searchable
        searchValue={search}
        onSearch={(q) => { setSearch(q); setPage(1) }}
        emptyText="No users found."
        actions={(user) => (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(user)}
            disabled={!!user.deletedAt}
          >
            Delete
          </Button>
        )}
      />

      {total > 20 && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <Button variant="outline" size="sm" disabled={users.length < 20} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete user"
        message={`Delete ${deleteTarget?.name}? This will deactivate all their roles. This cannot be undone.`}
        danger
        onConfirm={() => deleteTarget && void handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
