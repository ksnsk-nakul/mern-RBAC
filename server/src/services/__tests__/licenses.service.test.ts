import { describe, it, expect, vi, beforeEach } from 'vitest'
import mongoose from 'mongoose'

const { mockFindOne, mockFind, mockCreate } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockFind:    vi.fn(),
  mockCreate:  vi.fn(),
}))

vi.mock('../../models/License.js', () => ({
  License: {
    findOne: mockFindOne,
    find:    mockFind,
    create:  mockCreate,
  },
}))

import * as LicensesService from '../licenses.service.js'

const MOCK_ID   = '507f1f77bcf86cd799439011'
const MOCK_PROD = '507f1f77bcf86cd799439012'

function makeLicense(overrides = {}) {
  return {
    _id:       { toString: () => MOCK_ID },
    userId:    { toString: () => MOCK_ID },
    productId: { toString: () => MOCK_PROD },
    key:       'abc123',
    status:    'active',
    expiresAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('verifyLicense', () => {
  it('returns valid:true for active non-expired license', async () => {
    const license = makeLicense()
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(license) })

    const result = await LicensesService.verifyLicense('abc123')

    expect(result.valid).toBe(true)
    expect(result.userId).toBe(MOCK_ID)
  })

  it('returns valid:false when license not found', async () => {
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })

    const result = await LicensesService.verifyLicense('bad-key')

    expect(result.valid).toBe(false)
  })

  it('returns valid:false for expired license', async () => {
    const license = makeLicense({ expiresAt: new Date('2020-01-01') })
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(license) })

    const result = await LicensesService.verifyLicense('abc123')

    expect(result.valid).toBe(false)
  })

  it('returns valid:false for suspended license', async () => {
    const license = makeLicense({ status: 'suspended' })
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(license) })

    const result = await LicensesService.verifyLicense('abc123')

    expect(result.valid).toBe(false)
  })
})

describe('createLicense', () => {
  it('creates and returns a license', async () => {
    const license = makeLicense()
    mockCreate.mockResolvedValue(license)

    const userId = new mongoose.Types.ObjectId(MOCK_ID)
    const result = await LicensesService.createLicense(userId, MOCK_PROD)

    expect(result.key).toBe('abc123')
    expect(result.status).toBe('active')
  })
})

describe('listLicenses', () => {
  it('returns all licenses without filter', async () => {
    const chain = { sort: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([makeLicense()]) }
    mockFind.mockReturnValue(chain)

    const result = await LicensesService.listLicenses()

    expect(result).toHaveLength(1)
    expect(mockFind).toHaveBeenCalledWith({})
  })
})
