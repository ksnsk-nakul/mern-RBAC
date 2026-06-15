import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.JWT_ACCESS_SECRET      = 'test_access_secret_that_is_at_least_32_chars_long'
process.env.JWT_REFRESH_SECRET     = 'test_refresh_secret_that_is_at_least_32_chars_long'
process.env.SECRETS_ENCRYPTION_KEY = 'a'.repeat(64)
process.env.MONGODB_URI            = 'mongodb://localhost:27017/test'

vi.mock('../../config/env.js', () => ({
  env: {
    MONGODB_URI:            'mongodb://localhost:27017/test',
    JWT_ACCESS_SECRET:      'test_access_secret_that_is_at_least_32_chars_long',
    JWT_REFRESH_SECRET:     'test_refresh_secret_that_is_at_least_32_chars_long',
    SECRETS_ENCRYPTION_KEY: 'a'.repeat(64),
    NODE_ENV:               'test',
    PORT:                   5000,
    AI_SERVICE_URL:         'http://ai:8001',
    SEED_ADMIN_EMAIL:       'admin@admin.com',
    SEED_ADMIN_PASSWORD:    'changeme',
  },
}))

vi.mock('speakeasy', () => ({
  default: {
    generateSecret: vi.fn(() => ({
      base32:      'JBSWY3DPEHPK3PXP',
      otpauth_url: 'otpauth://totp/Test%20(test%40example.com)?secret=JBSWY3DPEHPK3PXP',
    })),
    totp: { verify: vi.fn() },
  },
}))

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,fake') },
}))

vi.mock('../../models/User.js', () => ({
  User: { findById: vi.fn() },
}))

import speakeasy   from 'speakeasy'
import mongoose    from 'mongoose'
import { User }    from '../../models/User.js'
import {
  generateMfaSetup,
  verifyAndEnableMfa,
  disableMfa,
  verifyTotp,
  useRecoveryCode,
  regenerateRecoveryCodes,
  getMfaStatus,
} from '../mfa.service.js'
import { NotFoundError, AppError } from '../../lib/errors.js'

const userId = new mongoose.Types.ObjectId()

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    _id:              userId,
    email:            'test@example.com',
    mfaEnabled:       false,
    mfaTotpSecret:    undefined as string | undefined,
    mfaRecoveryCodes: [] as string[],
    save:             vi.fn(),
    ...overrides,
  }
}

// Mock User.findById to chain .select() — the service calls .select('+mfaTotpSecret ...')
function mockFindById(returnValue: ReturnType<typeof makeUser> | null) {
  vi.mocked(User.findById).mockReturnValue({
    select: vi.fn().mockResolvedValue(returnValue),
  } as any)
}

beforeEach(() => vi.clearAllMocks())

describe('generateMfaSetup', () => {
  it('throws if user not found', async () => {
    mockFindById(null)
    await expect(generateMfaSetup(userId, 'App')).rejects.toThrow(NotFoundError)
  })

  it('throws if MFA already enabled', async () => {
    mockFindById(makeUser({ mfaEnabled: true }))
    await expect(generateMfaSetup(userId, 'App')).rejects.toThrow(AppError)
  })

  it('saves pending secret and returns QR + 8 recovery codes', async () => {
    const user = makeUser()
    mockFindById(user)

    const result = await generateMfaSetup(userId, 'App')

    expect(user.mfaTotpSecret).toBe('JBSWY3DPEHPK3PXP')
    expect(user.mfaRecoveryCodes).toHaveLength(8)
    expect(result.recoveryCodes).toHaveLength(8)
    expect(result.qrCodeDataUrl).toMatch(/^data:image\/png/)
    expect(user.save).toHaveBeenCalledOnce()
  })
})

describe('verifyAndEnableMfa', () => {
  it('throws if MFA setup not started', async () => {
    mockFindById(makeUser({ mfaTotpSecret: undefined }))
    await expect(verifyAndEnableMfa(userId, '123456')).rejects.toThrow(AppError)
  })

  it('throws on invalid TOTP', async () => {
    mockFindById(makeUser({ mfaTotpSecret: 'SECRET' }))
    vi.mocked(speakeasy.totp.verify).mockReturnValue(false)
    await expect(verifyAndEnableMfa(userId, '000000')).rejects.toThrow(AppError)
  })

  it('enables MFA on valid TOTP', async () => {
    const user = makeUser({ mfaTotpSecret: 'SECRET' })
    mockFindById(user)
    vi.mocked(speakeasy.totp.verify).mockReturnValue(true)

    await verifyAndEnableMfa(userId, '123456')

    expect(user.mfaEnabled).toBe(true)
    expect(user.save).toHaveBeenCalledOnce()
  })
})

describe('disableMfa', () => {
  it('throws if MFA not enabled', async () => {
    mockFindById(makeUser({ mfaEnabled: false }))
    await expect(disableMfa(userId, '123456')).rejects.toThrow(AppError)
  })

  it('throws on invalid TOTP', async () => {
    mockFindById(makeUser({ mfaEnabled: true, mfaTotpSecret: 'SECRET' }))
    vi.mocked(speakeasy.totp.verify).mockReturnValue(false)
    await expect(disableMfa(userId, '000000')).rejects.toThrow(AppError)
  })

  it('clears all MFA data on valid TOTP', async () => {
    const user = makeUser({ mfaEnabled: true, mfaTotpSecret: 'SECRET', mfaRecoveryCodes: ['hash1'] })
    mockFindById(user)
    vi.mocked(speakeasy.totp.verify).mockReturnValue(true)

    await disableMfa(userId, '123456')

    expect(user.mfaEnabled).toBe(false)
    expect(user.mfaTotpSecret).toBeUndefined()
    expect(user.mfaRecoveryCodes).toEqual([])
    expect(user.save).toHaveBeenCalledOnce()
  })
})

describe('verifyTotp', () => {
  it('returns true when speakeasy returns true', () => {
    vi.mocked(speakeasy.totp.verify).mockReturnValue(true)
    expect(verifyTotp('SECRET', '123456')).toBe(true)
  })

  it('returns false when speakeasy returns false', () => {
    vi.mocked(speakeasy.totp.verify).mockReturnValue(false)
    expect(verifyTotp('SECRET', '000000')).toBe(false)
  })
})

describe('useRecoveryCode', () => {
  it('removes used recovery code hash', async () => {
    const crypto = await import('crypto')
    const hash   = crypto.createHash('sha256').update('AABBCCDD').digest('hex')
    const user   = makeUser({ mfaEnabled: true, mfaTotpSecret: 'SECRET', mfaRecoveryCodes: [hash, 'otherhash'] })
    mockFindById(user)

    await useRecoveryCode(userId, 'AABBCCDD')

    expect(user.mfaRecoveryCodes).toEqual(['otherhash'])
    expect(user.save).toHaveBeenCalledOnce()
  })

  it('throws on invalid recovery code', async () => {
    const user = makeUser({ mfaEnabled: true, mfaTotpSecret: 'SECRET', mfaRecoveryCodes: [] })
    mockFindById(user)
    await expect(useRecoveryCode(userId, 'BADCODE1')).rejects.toThrow(AppError)
  })
})

describe('getMfaStatus', () => {
  it('returns enabled status and remaining codes count', async () => {
    mockFindById(makeUser({ mfaEnabled: true, mfaRecoveryCodes: ['h1', 'h2', 'h3'] }))

    const result = await getMfaStatus(userId)
    expect(result).toEqual({ enabled: true, codesRemaining: 3 })
  })
})

describe('regenerateRecoveryCodes', () => {
  it('throws if MFA not enabled', async () => {
    mockFindById(makeUser({ mfaEnabled: false }))
    await expect(regenerateRecoveryCodes(userId, '123456')).rejects.toThrow(AppError)
  })

  it('throws on invalid TOTP', async () => {
    mockFindById(makeUser({ mfaEnabled: true, mfaTotpSecret: 'SECRET' }))
    vi.mocked(speakeasy.totp.verify).mockReturnValue(false)
    await expect(regenerateRecoveryCodes(userId, '000000')).rejects.toThrow(AppError)
  })

  it('replaces all recovery code hashes and returns 8 raw codes', async () => {
    const user = makeUser({ mfaEnabled: true, mfaTotpSecret: 'SECRET', mfaRecoveryCodes: ['oldhash'] })
    mockFindById(user)
    vi.mocked(speakeasy.totp.verify).mockReturnValue(true)

    const raw = await regenerateRecoveryCodes(userId, '123456')

    expect(raw).toHaveLength(8)
    expect(user.mfaRecoveryCodes).toHaveLength(8)
    expect(user.mfaRecoveryCodes).not.toContain('oldhash')
    expect(user.save).toHaveBeenCalledOnce()
  })
})
