import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Badge }  from '@/components/ui/badge'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'

interface Product {
  id:          string
  name:        string
  slug:        string
  description: string
  price:       number
  currency:    string
  billingCycle: string
  features:    string[]
  isActive:    boolean
}

const CYCLE_LABEL: Record<string, string> = {
  monthly: '/mo', yearly: '/yr', one_time: ' once',
}

const EMPTY: Omit<Product, 'id'> = {
  name: '', slug: '', description: '', price: 0, currency: 'USD',
  billingCycle: 'monthly', features: [], isActive: true,
}

export default function ProductsPage() {
  const [products,   setProducts]   = useState<Product[]>([])
  const [loading,    setLoading]    = useState(true)
  const [editing,    setEditing]    = useState<Product | null>(null)
  const [form,       setForm]       = useState<Omit<Product, 'id'>>(EMPTY)
  const [showForm,   setShowForm]   = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/products')
      setProducts(data.products)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setShowForm(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({ name: p.name, slug: p.slug, description: p.description, price: p.price, currency: p.currency, billingCycle: p.billingCycle, features: p.features, isActive: p.isActive })
    setShowForm(true)
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      if (editing) {
        await api.patch(`/products/${editing.id}`, form)
      } else {
        await api.post('/products', form)
      }
      setShowForm(false)
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this product?')) return
    await api.delete(`/products/${id}`)
    await load()
  }

  function formatPrice(p: Product) {
    return `${p.currency} ${p.price.toFixed(2)}${CYCLE_LABEL[p.billingCycle] ?? ''}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground">Manage your product catalog.</p>
        </div>
        <Button size="sm" onClick={openCreate}>+ New product</Button>
      </div>

      {showForm && (
        <div className="rounded-lg border p-4 space-y-3 max-w-xl">
          <p className="font-medium text-sm">{editing ? 'Edit product' : 'New product'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pro Plan" />
            </div>
            <div className="space-y-1">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} placeholder="pro-plan" />
            </div>
            <div className="space-y-1">
              <Label>Price</Label>
              <Input type="number" min={0} step={0.01} value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1">
              <Label>Billing cycle</Label>
              <select value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="one_time">One-time</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <Label>Features (one per line)</Label>
            <textarea value={form.features.join('\n')} onChange={(e) => setForm({ ...form, features: e.target.value.split('\n').filter(Boolean) })} rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void handleSubmit()} disabled={submitting || !form.name.trim() || !form.slug.trim()}>
              {submitting ? '…' : editing ? 'Save changes' : 'Create'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {loading
        ? <p className="text-sm text-muted-foreground">Loading…</p>
        : products.length === 0
          ? <p className="text-sm text-muted-foreground">No products yet.</p>
          : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {['Name', 'Slug', 'Price', 'Cycle', 'Status', ''].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 font-medium">{p.name}</td>
                      <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{p.slug}</td>
                      <td className="px-3 py-2">{formatPrice(p)}</td>
                      <td className="px-3 py-2 text-muted-foreground capitalize">{p.billingCycle.replace('_', ' ')}</td>
                      <td className="px-3 py-2">
                        <Badge variant={p.isActive ? 'default' : 'outline'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>Edit</Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void handleDelete(p.id)}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      }
    </div>
  )
}
