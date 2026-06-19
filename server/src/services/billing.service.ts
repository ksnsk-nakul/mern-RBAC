import mongoose from 'mongoose'
import { Plan } from '../models/Plan.js'
import { NotFoundError, AppError } from '../lib/errors.js'

export interface PlanItem {
  id:            string
  name:          string
  slug:          string
  priceCents:    number
  currency:      string
  billingPeriod: 'month' | 'year'
  features:      string[]
  stripePriceId: string
  active:        boolean
  createdAt:     string
}

interface PlanLean {
  _id: mongoose.Types.ObjectId
  name: string
  slug: string
  priceCents: number
  currency: string
  billingPeriod: 'month' | 'year'
  features: string[]
  stripePriceId: string
  active: boolean
  createdAt: Date
}

function toPlanItem(p: PlanLean): PlanItem {
  return {
    id:            String(p._id),
    name:          p.name,
    slug:          p.slug,
    priceCents:    p.priceCents,
    currency:      p.currency,
    billingPeriod: p.billingPeriod,
    features:      p.features,
    stripePriceId: p.stripePriceId,
    active:        p.active,
    createdAt:     p.createdAt?.toISOString() ?? '',
  }
}

export interface CreatePlanInput {
  name:          string
  slug:          string
  priceCents:    number
  currency:      string
  billingPeriod: 'month' | 'year'
  features:      string[]
  stripePriceId: string
}

export async function createPlan(input: CreatePlanInput): Promise<PlanItem> {
  const existing = await Plan.findOne({ slug: input.slug })
  if (existing) throw new AppError(`Plan slug '${input.slug}' is already taken`, 409)

  const plan = await Plan.create({ ...input, active: true })
  return toPlanItem(plan as unknown as PlanLean)
}

export async function listPlans(opts: { activeOnly?: boolean } = {}): Promise<PlanItem[]> {
  const filter = opts.activeOnly ? { active: true } : {}
  const plans = await Plan.find(filter).sort({ createdAt: -1 }).lean()
  return (plans as unknown as PlanLean[]).map(toPlanItem)
}

export async function getPlan(id: string): Promise<PlanItem> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError('Plan not found')
  const plan = await Plan.findById(id).lean()
  if (!plan) throw new NotFoundError('Plan not found')
  return toPlanItem(plan as unknown as PlanLean)
}

export interface UpdatePlanInput {
  name?:          string
  slug?:          string
  priceCents?:    number
  currency?:      string
  billingPeriod?: 'month' | 'year'
  features?:      string[]
  stripePriceId?: string
  active?:        boolean
}

export async function updatePlan(id: string, input: UpdatePlanInput): Promise<PlanItem> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError('Plan not found')

  if (input.slug) {
    const existing = await Plan.findOne({ slug: input.slug, _id: { $ne: new mongoose.Types.ObjectId(id) } })
    if (existing) throw new AppError(`Plan slug '${input.slug}' is already taken`, 409)
  }

  const plan = await Plan.findByIdAndUpdate(id, { $set: input }, { new: true }).lean()
  if (!plan) throw new NotFoundError('Plan not found')
  return toPlanItem(plan as unknown as PlanLean)
}
