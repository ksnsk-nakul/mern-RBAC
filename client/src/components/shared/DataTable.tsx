import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import type { ReactNode } from 'react'

export interface Column<T> {
  key:    string
  header: string
  render: (row: T) => ReactNode
  width?: string
}

interface Props<T> {
  columns:      Column<T>[]
  data:         T[]
  loading?:     boolean
  searchable?:  boolean
  onSearch?:    (q: string) => void
  searchValue?: string
  emptyText?:   string
  actions?:     (row: T) => ReactNode
}

export function DataTable<T extends { id: string }>({
  columns, data, loading, searchable, onSearch, searchValue = '', emptyText = 'No results.', actions,
}: Props<T>) {
  return (
    <div className="space-y-3">
      {searchable && (
        <Input
          placeholder="Search…"
          value={searchValue}
          onChange={(e) => onSearch?.(e.target.value)}
          className="max-w-sm"
        />
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} style={{ width: col.width }}>{col.header}</TableHead>
              ))}
              {actions && <TableHead className="w-24 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + (actions ? 1 : 0)} className="h-24 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (actions ? 1 : 0)} className="h-24 text-center text-muted-foreground">
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>{col.render(row)}</TableCell>
                  ))}
                  {actions && (
                    <TableCell className="text-right">{actions(row)}</TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
