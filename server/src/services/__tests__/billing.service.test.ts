import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.JWT_ACCESS_SECRET       = 'test_access_secret_that_is_at_least_32_chars_long'
process.env.JWT_REFRESH_SECRET      = 'test_refresh_secret_that_is_at_least_32_chars_long'
process.env.SECRETS_ENCRYPTION_KEY  = '0'.repeat(64)
process.env.MONGODB_URI             = 'mongodb://localhost:27017/test'

vi.mock('../../config/env.js', () => ({
  env: {
    JWT_ACCESS_SECRET:      'test_access_secret_that_is_at_least_32_chars_long',
    JWT_REFRESH_SECRET:     'test_refresh_secret_that_is_at_least_32_chars_long',
    SECRETS_ENCRYPTION_KEY: '0'.repeat(64),
    MONGODB_URI:            'mongodb://localhost:27017/test',
    NODE_ENV:               'test',
    PORT:                   5000,
    AI_SERVICE_URL:         'http://ai:8001',
    CLIENT_URL:             'http://localhost:8080',
    SEED_ADMIN_EMAIL:       'admin@admin.com',
    SEED_ADMIN_PASSWORD:    'changeme',
  },
}))

const { mockPlanCreate, mockPlanFind, mockPlanFindOne, mockPlanFindById, mockPlanFindByIdAndUpdate,
        mockSubFindOne, mockSubCreate, mockSubUpdateOne,
        mockPaymentFind, mockPaymentCountDocuments, mockPaymentCreate, mockPaymentFindOne,
        mockRevealSecret,
        mockCustomersCreate, mockCheckoutSessionsCreate, mockPortalSessionsCreate, mockSubscriptionsUpdate } = vi.hoisted(() => ({
  mockPlanCreate:            vi.fn(),
  mockPlanFind:              vi.fn(),
  mockPlanFindOne:           vi.fn(),
  mockPlanFindById:          vi.fn(),
  mockPlanFindByIdAndUpdate: vi.fn(),
  mockSubFindOne:            vi.fn(),
  mockSubCreate:             vi.fn(),
  mockSubUpdateOne:          vi.fn(),
  mockPaymentFind:           vi.fn(),
  mockPaymentCountDocuments: vi.fn(),
  mockPaymentCreate:         vi.fn(),
  mockPaymentFindOne:        vi.fn(),
  mockRevealSecret:          vi.fn(),
  mockCustomersCreate:        vi.fn(),
  mockCheckoutSessionsCreate: vi.fn(),
  mockPortalSessionsCreate:   vi.fn(),
  mockSubscriptionsUpdate:    vi.fn(),
}))

vi.mock('../../models/Plan.js', () => ({
  Plan: {
    create:            mockPlanCreate,
    find:              mockPlanFind,
    findOne:           mockPlanFindOne,
    findById:          mockPlanFindById,
    findByIdAndUpdate: mockPlanFindByIdAndUpdate,
  },
}))
vi.mock('../../models/Subscription.js', () => ({
  Subscription: { findOne: mockSubFindOne, create: mockSubCreate, updateOne: mockSubUpdateOne },
}))
vi.mock('../../models/PaymentEvent.js', () => ({
  PaymentEvent: { find: mockPaymentFind, countDocuments: mockPaymentCountDocuments, create: mockPaymentCreate, findOne: mockPaymentFindOne },
}))
vi.mock('../../services/secrets.service.js', () => ({ revealSecret: mockRevealSecret }))
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    customers:     { create: mockCustomersCreate },
    checkout:      { sessions: { create: mockCheckoutSessionsCreate } },
    billingPortal: { sessions: { create: mockPortalSessionsCreate } },
    subscriptions: { update: mockSubscriptionsUpdate },
    webhooks:      { constructEvent: vi.fn() },
  })),
}))

import mongoose from 'mongoose'
import { createPlan, listPlans, getPlan, updatePlan } from '../billing.service.js'
import { createCheckoutSession, createPortalSession, cancelSubscription, getBillingOverview, listPayments, processStripeWebhookEvent } from '../billing.service.js'
import { NotFoundError, AppError } from '../../lib/errors.js'

const planId = new mongoose.Types.ObjectId()

beforeEach(() => {
  vi.clearAllMocks()
  mockRevealSecret.mockResolvedValue('sk_test_fake')
})

describe('createPlan', () => {
  it('creates a plan when the slug is free', async () => {
    mockPlanFindOne.mockResolvedValue(null)
    mockPlanCreate.mockResolvedValue({
      _id: planId, name: 'Pro', slug: 'pro', priceCents: 2900, currency: 'usd',
      billingPeriod: 'month', features: ['Feature A'], stripePriceId: 'price_123', active: true,
      createdAt: new Date(),
    })

    const result = await createPlan({
      name: 'Pro', slug: 'pro', priceCents: 2900, currency: 'usd',
      billingPeriod: 'month', features: ['Feature A'], stripePriceId: 'price_123',
    })

    expect(mockPlanCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Pro', slug: 'pro', priceCents: 2900, active: true }),
    )
    expect(result.id).toBe(String(planId))
  })

  it('throws AppError if the slug is already taken', async () => {
    mockPlanFindOne.mockResolvedValue({ slug: 'pro' })
    await expect(createPlan({
      name: 'Pro', slug: 'pro', priceCents: 2900, currency: 'usd',
      billingPeriod: 'month', features: [], stripePriceId: 'price_123',
    })).rejects.toThrow(AppError)
  })
})

describe('listPlans', () => {
  it('returns all plans when activeOnly is not set', async () => {
    mockPlanFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { _id: planId, name: 'Pro', slug: 'pro', priceCents: 2900, currency: 'usd', billingPeriod: 'month', features: [], stripePriceId: 'price_123', active: true, createdAt: new Date() },
        ]),
      }),
    })

    const result = await listPlans()

    expect(mockPlanFind).toHaveBeenCalledWith({})
    expect(result).toHaveLength(1)
  })

  it('filters to active plans when activeOnly is true', async () => {
    mockPlanFind.mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) })
    await listPlans({ activeOnly: true })
    expect(mockPlanFind).toHaveBeenCalledWith({ active: true })
  })
})

describe('getPlan', () => {
  it('throws NotFoundError for an invalid id', async () => {
    await expect(getPlan('not-an-id')).rejects.toThrow(NotFoundError)
  })

  it('throws NotFoundError when no plan matches', async () => {
    mockPlanFindById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    await expect(getPlan(String(planId))).rejects.toThrow(NotFoundError)
  })
})

describe('updatePlan', () => {
  it('throws AppError if the new slug is already taken by another plan', async () => {
    mockPlanFindOne.mockResolvedValue({ slug: 'enterprise' })
    await expect(updatePlan(String(planId), { slug: 'enterprise' })).rejects.toThrow(AppError)
  })

  it('throws NotFoundError when no plan matches', async () => {
    mockPlanFindOne.mockResolvedValue(null)
    mockPlanFindByIdAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    await expect(updatePlan(String(planId), { active: false })).rejects.toThrow(NotFoundError)
  })

  it('updates and returns the plan on success', async () => {
    mockPlanFindOne.mockResolvedValue(null)
    mockPlanFindByIdAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: planId, name: 'Pro', slug: 'pro', priceCents: 2900, currency: 'usd',
        billingPeriod: 'month', features: [], stripePriceId: 'price_123', active: false, createdAt: new Date(),
      }),
    })

    const result = await updatePlan(String(planId), { active: false })
    expect(result.active).toBe(false)
  })
})

const orgId = new mongoose.Types.ObjectId()
const subId = new mongoose.Types.ObjectId()

describe('createCheckoutSession', () => {
  it('throws NotFoundError for a plan that does not exist or is inactive', async () => {
    mockPlanFindOne.mockResolvedValue(null)
    await expect(createCheckoutSession(orgId, String(planId))).rejects.toThrow(NotFoundError)
  })

  it('creates a Stripe customer on first checkout and reuses it on a second', async () => {
    mockPlanFindOne.mockResolvedValue({ _id: planId, stripePriceId: 'price_123', active: true })
    mockSubFindOne.mockResolvedValue(null)
    const created = { _id: subId, orgId, planId, status: 'incomplete', stripeCustomerId: undefined, save: vi.fn() }
    mockSubCreate.mockResolvedValue(created)
    mockCustomersCreate.mockResolvedValue({ id: 'cus_123' })
    mockCheckoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session_abc' })

    const result = await createCheckoutSession(orgId, String(planId))

    expect(mockCustomersCreate).toHaveBeenCalledWith(expect.objectContaining({ metadata: { orgId: String(orgId) } }))
    expect(created.save).toHaveBeenCalled()
    expect(result.checkoutUrl).toBe('https://checkout.stripe.com/session_abc')
  })

  it('reuses an existing Stripe customer without creating a new one', async () => {
    mockPlanFindOne.mockResolvedValue({ _id: planId, stripePriceId: 'price_123', active: true })
    const existingSub = { _id: subId, orgId, planId, status: 'active', stripeCustomerId: 'cus_existing', save: vi.fn() }
    mockSubFindOne.mockResolvedValue(existingSub)
    mockCheckoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session_xyz' })

    await createCheckoutSession(orgId, String(planId))

    expect(mockCustomersCreate).not.toHaveBeenCalled()
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_existing', mode: 'subscription' }),
    )
  })

  it('updates planId on the existing subscription when checking out for a different plan', async () => {
    const newPlanId = new mongoose.Types.ObjectId()
    mockPlanFindOne.mockResolvedValue({ _id: newPlanId, stripePriceId: 'price_456', active: true })
    const existingSub = {
      _id: subId, orgId, planId, status: 'canceled', stripeCustomerId: 'cus_existing',
      save: vi.fn(),
    }
    mockSubFindOne.mockResolvedValue(existingSub)
    mockCheckoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session_new' })

    await createCheckoutSession(orgId, String(newPlanId))

    expect(existingSub.planId).toEqual(newPlanId)
    expect(existingSub.save).toHaveBeenCalled()
  })
})

describe('createPortalSession', () => {
  it('throws AppError when the org has no Stripe customer yet', async () => {
    mockSubFindOne.mockResolvedValue(null)
    await expect(createPortalSession(orgId)).rejects.toThrow(AppError)
  })

  it('returns a portal URL for an org with a Stripe customer', async () => {
    mockSubFindOne.mockResolvedValue({ stripeCustomerId: 'cus_123' })
    mockPortalSessionsCreate.mockResolvedValue({ url: 'https://billing.stripe.com/portal_abc' })

    const result = await createPortalSession(orgId)
    expect(result.portalUrl).toBe('https://billing.stripe.com/portal_abc')
  })
})

describe('cancelSubscription', () => {
  it('throws NotFoundError when there is no active Stripe subscription', async () => {
    mockSubFindOne.mockResolvedValue(null)
    await expect(cancelSubscription(orgId)).rejects.toThrow(NotFoundError)
  })

  it('calls Stripe to cancel at period end and updates the local flag', async () => {
    const sub = { stripeSubscriptionId: 'sub_123', cancelAtPeriodEnd: false, save: vi.fn() }
    mockSubFindOne.mockResolvedValue(sub)

    await cancelSubscription(orgId)

    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_123', { cancel_at_period_end: true })
    expect(sub.cancelAtPeriodEnd).toBe(true)
    expect(sub.save).toHaveBeenCalled()
  })
})

describe('getBillingOverview', () => {
  it('returns null subscription and active plans when the org has no subscription', async () => {
    mockSubFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    mockPlanFind.mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) })

    const result = await getBillingOverview(orgId)
    expect(result.subscription).toBeNull()
  })

  it('returns null subscription when the existing subscription is canceled, allowing resubscribe', async () => {
    mockSubFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: subId, planId, status: 'canceled', cancelAtPeriodEnd: false }),
    })
    mockPlanFind.mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) })

    const result = await getBillingOverview(orgId)
    expect(result.subscription).toBeNull()
  })

  it('returns the active subscription with plan name resolved', async () => {
    mockSubFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: subId, planId, status: 'active', currentPeriodEnd: new Date('2026-07-01'), cancelAtPeriodEnd: false,
      }),
    })
    mockPlanFind.mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) })
    mockPlanFindById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ name: 'Pro' }) })

    const result = await getBillingOverview(orgId)
    expect(result.subscription?.planName).toBe('Pro')
    expect(result.subscription?.status).toBe('active')
  })
})

describe('listPayments', () => {
  it('returns paginated payment items', async () => {
    mockPaymentFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([
              { _id: new mongoose.Types.ObjectId(), type: 'invoice.paid', amountCents: 2900, status: 'paid', createdAt: new Date() },
            ]),
          }),
        }),
      }),
    })
    mockPaymentCountDocuments.mockResolvedValue(1)

    const result = await listPayments(orgId, { page: 1, limit: 20 })
    expect(result.total).toBe(1)
    expect(result.payments[0]!.type).toBe('invoice.paid')
  })
})

describe('processStripeWebhookEvent', () => {
  it('checkout.session.completed activates the matching subscription and clears any stale cancel flag', async () => {
    const sub = { stripeSubscriptionId: undefined, status: 'incomplete', cancelAtPeriodEnd: true, save: vi.fn() }
    mockSubFindOne.mockResolvedValue(sub)

    await processStripeWebhookEvent({
      id: 'evt_1', type: 'checkout.session.completed',
      data: { object: { customer: 'cus_123', subscription: 'sub_123' } },
    } as any)

    expect(sub.stripeSubscriptionId).toBe('sub_123')
    expect(sub.status).toBe('active')
    expect(sub.cancelAtPeriodEnd).toBe(false)
    expect(sub.save).toHaveBeenCalled()
  })

  it('customer.subscription.updated syncs status and period end', async () => {
    const sub = { status: 'incomplete', currentPeriodEnd: undefined as Date | undefined, cancelAtPeriodEnd: false, save: vi.fn() }
    mockSubFindOne.mockResolvedValue(sub)

    await processStripeWebhookEvent({
      id: 'evt_2', type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123', status: 'active', cancel_at_period_end: true,
          items: { data: [{ current_period_end: 1893456000 }] },
        },
      },
    } as any)

    expect(sub.status).toBe('active')
    expect(sub.currentPeriodEnd).toEqual(new Date(1893456000 * 1000))
    expect(sub.cancelAtPeriodEnd).toBe(true)
    expect(sub.save).toHaveBeenCalled()
  })

  it('customer.subscription.deleted marks the subscription canceled', async () => {
    await processStripeWebhookEvent({
      id: 'evt_3', type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_123' } },
    } as any)

    expect(mockSubUpdateOne).toHaveBeenCalledWith({ stripeSubscriptionId: 'sub_123' }, { $set: { status: 'canceled' } })
  })

  it('invoice.paid is idempotent on stripeEventId', async () => {
    mockPaymentFindOne.mockResolvedValue({ stripeEventId: 'evt_4' })

    await processStripeWebhookEvent({
      id: 'evt_4', type: 'invoice.paid',
      data: { object: { customer: 'cus_123', amount_paid: 2900 } },
    } as any)

    expect(mockPaymentCreate).not.toHaveBeenCalled()
  })

  it('invoice.paid records a new PaymentEvent when not already processed', async () => {
    mockPaymentFindOne.mockResolvedValue(null)
    mockSubFindOne.mockResolvedValue({ _id: subId, orgId })

    await processStripeWebhookEvent({
      id: 'evt_5', type: 'invoice.paid',
      data: { object: { customer: 'cus_123', amount_paid: 2900 } },
    } as any)

    expect(mockPaymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ orgId, subscriptionId: subId, stripeEventId: 'evt_5', type: 'invoice.paid', amountCents: 2900, status: 'paid' }),
    )
  })

  it('invoice.paid swallows a duplicate-key error from a concurrent delivery instead of throwing', async () => {
    mockPaymentFindOne.mockResolvedValue(null)
    mockSubFindOne.mockResolvedValue({ _id: subId, orgId })
    const duplicateKeyError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 })
    mockPaymentCreate.mockRejectedValue(duplicateKeyError)

    await expect(processStripeWebhookEvent({
      id: 'evt_6', type: 'invoice.paid',
      data: { object: { customer: 'cus_123', amount_paid: 2900 } },
    } as any)).resolves.toBeUndefined()
  })

  it('invoice.paid rethrows a non-duplicate-key error from create', async () => {
    mockPaymentFindOne.mockResolvedValue(null)
    mockSubFindOne.mockResolvedValue({ _id: subId, orgId })
    mockPaymentCreate.mockRejectedValue(new Error('connection lost'))

    await expect(processStripeWebhookEvent({
      id: 'evt_7', type: 'invoice.paid',
      data: { object: { customer: 'cus_123', amount_paid: 2900 } },
    } as any)).rejects.toThrow('connection lost')
  })
})
