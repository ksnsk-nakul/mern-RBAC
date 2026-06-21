import mongoose from 'mongoose'
import Stripe from 'stripe'
import { Plan } from '../models/Plan.js'
import { NotFoundError, AppError } from '../lib/errors.js'
import { env } from '../config/env.js'
import { Subscription, type SubscriptionStatus } from '../models/Subscription.js'
import { PaymentEvent } from '../models/PaymentEvent.js'
import * as SecretsService from './secrets.service.js'

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

async function getStripeClient(): Promise<Stripe> {
  const secretKey = await SecretsService.revealSecret('stripe.secret_key')
  return new Stripe(secretKey)
}

async function findOrCreateDraftSubscription(
  orgId:  mongoose.Types.ObjectId,
  planId: mongoose.Types.ObjectId,
) {
  const existing = await Subscription.findOne({ orgId })
  if (existing) return existing
  return Subscription.create({ orgId, planId, status: 'incomplete', cancelAtPeriodEnd: false })
}

export async function createCheckoutSession(
  orgId:  mongoose.Types.ObjectId,
  planId: string,
): Promise<{ checkoutUrl: string }> {
  if (!mongoose.Types.ObjectId.isValid(planId)) throw new NotFoundError('Plan not found')
  const plan = await Plan.findOne({ _id: planId, active: true })
  if (!plan) throw new NotFoundError('Plan not found')

  const sub = await findOrCreateDraftSubscription(orgId, plan._id as mongoose.Types.ObjectId)

  const stripe = await getStripeClient()

  let customerId = sub.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({ metadata: { orgId: String(orgId) } })
    customerId = customer.id
    sub.stripeCustomerId = customerId
    await sub.save()
  }

  const session = await stripe.checkout.sessions.create({
    mode:        'subscription',
    customer:    customerId,
    line_items:  [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${env.CLIENT_URL}/dashboard/organizations?billing=success`,
    cancel_url:  `${env.CLIENT_URL}/dashboard/organizations?billing=canceled`,
  })

  if (!session.url) throw new AppError('Failed to create checkout session', 502)
  return { checkoutUrl: session.url }
}

export async function createPortalSession(orgId: mongoose.Types.ObjectId): Promise<{ portalUrl: string }> {
  const sub = await Subscription.findOne({ orgId })
  if (!sub?.stripeCustomerId) throw new AppError('No billing account found for this organization', 404)

  const stripe = await getStripeClient()
  const session = await stripe.billingPortal.sessions.create({
    customer:   sub.stripeCustomerId,
    return_url: `${env.CLIENT_URL}/dashboard/organizations`,
  })

  return { portalUrl: session.url }
}

export async function cancelSubscription(orgId: mongoose.Types.ObjectId): Promise<void> {
  const sub = await Subscription.findOne({ orgId })
  if (!sub?.stripeSubscriptionId) throw new NotFoundError('No active subscription found')

  const stripe = await getStripeClient()
  await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true })

  sub.cancelAtPeriodEnd = true
  await sub.save()
}

export interface BillingOverview {
  subscription: {
    id:                string
    planId:            string
    planName:          string
    status:            SubscriptionStatus
    currentPeriodEnd:  string | null
    cancelAtPeriodEnd: boolean
  } | null
  plans: PlanItem[]
}

export async function getBillingOverview(orgId: mongoose.Types.ObjectId): Promise<BillingOverview> {
  const [sub, plans] = await Promise.all([
    Subscription.findOne({ orgId }).lean(),
    listPlans({ activeOnly: true }),
  ])

  if (!sub || sub.status === 'incomplete') {
    return { subscription: null, plans }
  }

  const plan = await Plan.findById(sub.planId).lean()

  return {
    subscription: {
      id:                String(sub._id),
      planId:            String(sub.planId),
      planName:          (plan as { name?: string } | null)?.name ?? 'Unknown plan',
      status:            sub.status,
      currentPeriodEnd:  sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    },
    plans,
  }
}

export interface PaymentEventItem {
  id:           string
  type:         string
  amountCents?: number
  status?:      string
  createdAt:    string
}

export async function listPayments(
  orgId: mongoose.Types.ObjectId,
  opts: { page?: number; limit?: number },
): Promise<{ payments: PaymentEventItem[]; total: number; pages: number }> {
  const page  = opts.page  ?? 1
  const limit = opts.limit ?? 20
  const skip  = (page - 1) * limit

  const filter = { orgId }
  const [events, total] = await Promise.all([
    PaymentEvent.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    PaymentEvent.countDocuments(filter),
  ])

  return {
    payments: events.map((e) => ({
      id:          String(e._id),
      type:        e.type,
      amountCents: e.amountCents,
      status:      e.status,
      createdAt:   (e as unknown as { createdAt: Date }).createdAt?.toISOString() ?? '',
    })),
    total,
    pages: Math.ceil(total / limit),
  }
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === 'active' || status === 'trialing') return 'active'
  if (status === 'past_due' || status === 'unpaid') return 'past_due'
  if (status === 'canceled') return 'canceled'
  return 'incomplete'
}

export async function processStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const customerId = session.customer as string
      const subscriptionId = session.subscription as string

      const sub = await Subscription.findOne({ stripeCustomerId: customerId })
      if (sub) {
        sub.stripeSubscriptionId = subscriptionId
        sub.status = 'active'
        sub.cancelAtPeriodEnd = false
        await sub.save()
      }
      break
    }
    case 'customer.subscription.updated': {
      const stripeSub = event.data.object as Stripe.Subscription
      const sub = await Subscription.findOne({ stripeSubscriptionId: stripeSub.id })
      if (sub) {
        // current_period_end moved from the subscription object to its line items
        // in newer Stripe API versions (subscriptions can have items with different periods)
        const currentPeriodEnd = stripeSub.items.data[0]?.current_period_end
        sub.status = mapStripeStatus(stripeSub.status)
        if (currentPeriodEnd) sub.currentPeriodEnd = new Date(currentPeriodEnd * 1000)
        sub.cancelAtPeriodEnd = stripeSub.cancel_at_period_end
        await sub.save()
      }
      break
    }
    case 'customer.subscription.deleted': {
      const stripeSub = event.data.object as Stripe.Subscription
      await Subscription.updateOne({ stripeSubscriptionId: stripeSub.id }, { $set: { status: 'canceled' } })
      break
    }
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const existing = await PaymentEvent.findOne({ stripeEventId: event.id })
      if (existing) return

      const invoice = event.data.object as Stripe.Invoice
      const sub = await Subscription.findOne({ stripeCustomerId: invoice.customer as string })
      if (!sub) return

      try {
        await PaymentEvent.create({
          orgId:          sub.orgId,
          subscriptionId: sub._id,
          stripeEventId:  event.id,
          type:           event.type,
          amountCents:    invoice.amount_paid ?? invoice.amount_due,
          status:         event.type === 'invoice.paid' ? 'paid' : 'failed',
          raw:            invoice as unknown as Record<string, unknown>,
        })
      } catch (err) {
        // A concurrent delivery of the same event may have already created this
        // row between our findOne check and this create call — the unique index
        // on stripeEventId is the real correctness guarantee, findOne is just a fast path.
        const isDuplicateKey = typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000
        if (!isDuplicateKey) throw err
      }
      break
    }
    default:
      break
  }
}
