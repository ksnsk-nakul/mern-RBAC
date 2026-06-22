import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Badge }  from '@/components/ui/badge'

interface PlanItem {
  id:            string
  name:          string
  slug:          string
  priceCents:    number
  currency:      string
  billingPeriod: 'month' | 'year'
  features:      string[]
  stripePriceId: string
  active:        boolean
}

function formatPrice(priceCents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(priceCents / 100)
}

export default function PlansPage() {
  const [plans,         setPlans]         = useState<PlanItem[]>([])
  const [loading,       setLoading]       = useState(true)
  const [creating,      setCreating]      = useState(false)
  const [togglingId,    setTogglingId]    = useState<string | null>(null)

  const [name,          setName]          = useState('')
  const [slug,          setSlug]          = useState('')
  const [priceDollars,  setPriceDollars]  = useState('')
  const [currency,      setCurrency]      = useState('usd')
  const [billingPeriod, setBillingPeriod] = useState<'month' | 'year'>('month')
  const [features,      setFeatures]      = useState('')
  const [stripePriceId, setStripePriceId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/billing/plans')
      setPlans(data.plans)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleCreate() {
    const priceCents = Math.round(parseFloat(priceDollars || '0') * 100)
    if (!name.trim() || !slug.trim() || !stripePriceId.trim() || !priceCents) return

    setCreating(true)
    try {
      await api.post('/admin/billing/plans', {
        name: name.trim(),
        slug: slug.trim(),
        priceCents,
        currency,
        billingPeriod,
        features: features.split('\n').map((f) => f.trim()).filter(Boolean),
        stripePriceId: stripePriceId.trim(),
      })
      setName(''); setSlug(''); setPriceDollars(''); setFeatures(''); setStripePriceId('')
      await load()
    } catch {
      alert('Failed to create plan.')
    } finally {
      setCreating(false)
    }
  }

  async function handleToggleActive(plan: PlanItem) {
    setTogglingId(plan.id)
    try {
      await api.patch(`/admin/billing/plans/${plan.id}`, { active: !plan.active })
      await load()
    } catch {
      alert('Failed to update plan.')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Plans</h1>
        <p className="text-sm text-muted-foreground">Manage subscription pricing tiers.</p>
      </div>

      <div className="rounded-lg border p-4 space-y-3 max-w-xl">
        <p className="text-sm font-medium">Create plan</p>
        <div className="grid grid-cols-2 gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name e.g. Pro" />
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Slug e.g. pro" />
          <Input value={priceDollars} onChange={(e) => setPriceDollars(e.target.value)} placeholder="Price (dollars) e.g. 29.00" type="number" />
          <Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="Currency e.g. usd" />
          <select value={billingPeriod} onChange={(e) => setBillingPeriod(e.target.value as 'month' | 'year')}
            className="rounded-md border bg-background px-3 py-2 text-sm">
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
          <Input value={stripePriceId} onChange={(e) => setStripePriceId(e.target.value)} placeholder="Stripe Price ID e.g. price_123" />
        </div>
        <textarea value={features} onChange={(e) => setFeatures(e.target.value)}
          placeholder="One feature per line" rows={3}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        <Button size="sm" onClick={() => void handleCreate()} disabled={creating}>
          {creating ? '…' : 'Create plan'}
        </Button>
      </div>

      {loading
        ? <p className="text-sm text-muted-foreground">Loading…</p>
        : plans.length === 0
          ? <p className="text-sm text-muted-foreground">No plans yet.</p>
          : (
            <div className="space-y-2">
              {plans.map((plan) => (
                <div key={plan.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{plan.name}</p>
                      <Badge variant={plan.active ? 'default' : 'secondary'}>{plan.active ? 'active' : 'inactive'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatPrice(plan.priceCents, plan.currency)} / {plan.billingPeriod} — <code>{plan.slug}</code>
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void handleToggleActive(plan)} disabled={togglingId === plan.id}>
                    {togglingId === plan.id ? '…' : plan.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              ))}
            </div>
          )
      }
    </div>
  )
}
