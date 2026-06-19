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

const { mockPlanCreate, mockPlanFind, mockPlanFindOne, mockPlanFindById, mockPlanFindByIdAndUpdate } = vi.hoisted(() => ({
  mockPlanCreate:           vi.fn(),
  mockPlanFind:             vi.fn(),
  mockPlanFindOne:          vi.fn(),
  mockPlanFindById:         vi.fn(),
  mockPlanFindByIdAndUpdate: vi.fn(),
}))

vi.mock('../../models/Plan.js', () => ({
  Plan: {
    create:           mockPlanCreate,
    find:             mockPlanFind,
    findOne:          mockPlanFindOne,
    findById:         mockPlanFindById,
    findByIdAndUpdate: mockPlanFindByIdAndUpdate,
  },
}))
vi.mock('../../models/Subscription.js', () => ({ Subscription: { findOne: vi.fn(), create: vi.fn() } }))
vi.mock('../../models/PaymentEvent.js', () => ({ PaymentEvent: { find: vi.fn(), countDocuments: vi.fn(), create: vi.fn(), findOne: vi.fn() } }))

import mongoose from 'mongoose'
import { createPlan, listPlans, getPlan, updatePlan } from '../billing.service.js'
import { NotFoundError, AppError } from '../../lib/errors.js'

const planId = new mongoose.Types.ObjectId()

beforeEach(() => { vi.clearAllMocks() })

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
