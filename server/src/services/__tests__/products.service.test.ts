import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFind, mockFindById, mockFindByIdAndUpdate, mockFindByIdAndDelete, mockCreate, mockCountDocuments } = vi.hoisted(() => ({
  mockFind:              vi.fn(),
  mockFindById:          vi.fn(),
  mockFindByIdAndUpdate: vi.fn(),
  mockFindByIdAndDelete: vi.fn(),
  mockCreate:            vi.fn(),
  mockCountDocuments:    vi.fn(),
}))

vi.mock('../../models/Product.js', () => ({
  Product: {
    find:              mockFind,
    findById:          mockFindById,
    findByIdAndUpdate: mockFindByIdAndUpdate,
    findByIdAndDelete: mockFindByIdAndDelete,
    create:            mockCreate,
    countDocuments:    mockCountDocuments,
  },
}))

import * as ProductsService from '../products.service.js'

const MOCK_ID = '507f1f77bcf86cd799439011'

function makeProduct(overrides = {}) {
  return {
    _id:         { toString: () => MOCK_ID },
    name:        'Pro',
    slug:        'pro',
    description: 'Pro plan',
    price:       9.99,
    currency:    'USD',
    billingCycle: 'monthly',
    features:    ['Feature A'],
    isActive:    true,
    createdAt:   new Date('2024-01-01'),
    updatedAt:   new Date('2024-01-01'),
    ...overrides,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('listProducts', () => {
  it('returns paginated products', async () => {
    const product = makeProduct()
    const chain = { sort: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([product]) }
    mockFind.mockReturnValue(chain)
    mockCountDocuments.mockResolvedValue(1)

    const result = await ProductsService.listProducts({ page: 1, limit: 10 })

    expect(result.products).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.pages).toBe(1)
    expect(result.products[0].name).toBe('Pro')
  })

  it('filters by isActive when provided', async () => {
    const chain = { sort: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([]) }
    mockFind.mockReturnValue(chain)
    mockCountDocuments.mockResolvedValue(0)

    await ProductsService.listProducts({ isActive: true, page: 1, limit: 10 })

    expect(mockFind).toHaveBeenCalledWith({ isActive: true })
  })
})

describe('createProduct', () => {
  it('creates and returns a product', async () => {
    const product = makeProduct()
    mockCreate.mockResolvedValue(product)

    const result = await ProductsService.createProduct({ name: 'Pro', slug: 'pro', price: 9.99 })

    expect(result.name).toBe('Pro')
    expect(result.slug).toBe('pro')
  })
})

describe('getProduct', () => {
  it('returns product by id', async () => {
    const product = makeProduct()
    mockFindById.mockReturnValue({ lean: vi.fn().mockResolvedValue(product) })

    const result = await ProductsService.getProduct(MOCK_ID)

    expect(result).not.toBeNull()
    expect(result!.id).toBe(MOCK_ID)
  })

  it('returns null for invalid id', async () => {
    const result = await ProductsService.getProduct('not-an-id')
    expect(result).toBeNull()
  })
})

describe('updateProduct', () => {
  it('updates and returns the product', async () => {
    const updated = makeProduct({ name: 'Pro Plus' })
    mockFindByIdAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(updated) })

    const result = await ProductsService.updateProduct(MOCK_ID, { name: 'Pro Plus' })

    expect(result!.name).toBe('Pro Plus')
  })
})

describe('deleteProduct', () => {
  it('returns true when deleted', async () => {
    mockFindByIdAndDelete.mockResolvedValue({ _id: MOCK_ID })

    const result = await ProductsService.deleteProduct(MOCK_ID)

    expect(result).toBe(true)
  })

  it('returns false when not found', async () => {
    mockFindByIdAndDelete.mockResolvedValue(null)

    const result = await ProductsService.deleteProduct(MOCK_ID)

    expect(result).toBe(false)
  })
})
