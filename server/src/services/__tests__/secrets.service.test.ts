import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.JWT_ACCESS_SECRET      = 'test_access_secret_that_is_at_least_32_chars_long'
process.env.JWT_REFRESH_SECRET     = 'test_refresh_secret_that_is_at_least_32_chars_long'
process.env.SECRETS_ENCRYPTION_KEY = 'a'.repeat(64) // 32 bytes as hex
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

vi.mock('../../models/Secret.js', () => ({
  Secret: {
    findOne: vi.fn(),
    find:    vi.fn(),
  },
}))
vi.mock('../../models/Permission.js', () => ({
  Permission: { findOneAndUpdate: vi.fn() },
}))

import mongoose from 'mongoose'
import { Secret } from '../../models/Secret.js'
import { encrypt, decrypt } from '../../lib/crypto.js'
import { revealSecret, setSecret, clearSecret } from '../secrets.service.js'
import { NotFoundError } from '../../lib/errors.js'

const secretId = new mongoose.Types.ObjectId()
const userId   = new mongoose.Types.ObjectId()

function makeDbSecret(overrides: Record<string, unknown> = {}) {
  return {
    _id:            secretId,
    group:          'stripe',
    name:           'Stripe Secret Key',
    slug:           'stripe.secret_key',
    isSet:          false,
    encryptedValue: undefined as string | undefined,
    iv:             undefined as string | undefined,
    authTag:        undefined as string | undefined,
    save:           vi.fn(),
    ...overrides,
  }
}

beforeEach(() => vi.clearAllMocks())

// ---- crypto unit tests ----
describe('encrypt / decrypt', () => {
  it('round-trips a plaintext value', () => {
    const plaintext = 'sk_test_supersecret_key_12345'
    const payload   = encrypt(plaintext)
    expect(payload.encryptedValue).toBeTruthy()
    expect(payload.iv).toBeTruthy()
    expect(payload.authTag).toBeTruthy()
    expect(decrypt(payload)).toBe(plaintext)
  })

  it('produces different ciphertext for the same input (random IV)', () => {
    const p1 = encrypt('same')
    const p2 = encrypt('same')
    expect(p1.encryptedValue).not.toBe(p2.encryptedValue)
    expect(p1.iv).not.toBe(p2.iv)
  })

  it('throws on tampered authTag', () => {
    const payload = encrypt('value')
    payload.authTag = Buffer.alloc(16).toString('base64')
    expect(() => decrypt(payload)).toThrow()
  })
})

// ---- service tests ----
describe('revealSecret', () => {
  it('throws NotFoundError for unknown slug', async () => {
    vi.mocked(Secret.findOne).mockResolvedValue(null)
    await expect(revealSecret('nonexistent')).rejects.toThrow(NotFoundError)
  })

  it('throws when secret is not set', async () => {
    vi.mocked(Secret.findOne).mockResolvedValue(makeDbSecret({ isSet: false }) as any)
    await expect(revealSecret('stripe.secret_key')).rejects.toThrow(NotFoundError)
  })

  it('decrypts and returns the stored value', async () => {
    const plaintext = 'sk_test_abc123'
    const { encryptedValue, iv, authTag } = encrypt(plaintext)
    vi.mocked(Secret.findOne).mockResolvedValue(
      makeDbSecret({ isSet: true, encryptedValue, iv, authTag }) as any,
    )

    const result = await revealSecret('stripe.secret_key')
    expect(result).toBe(plaintext)
  })
})

describe('setSecret', () => {
  it('encrypts and saves the value', async () => {
    const secret = makeDbSecret()
    vi.mocked(Secret.findOne).mockResolvedValue(secret as any)

    await setSecret('stripe.secret_key', 'my_secret_value', userId)

    expect(secret.isSet).toBe(true)
    expect(secret.encryptedValue).toBeTruthy()
    expect(secret.iv).toBeTruthy()
    expect(secret.authTag).toBeTruthy()
    expect(secret.save).toHaveBeenCalledOnce()

    // Verify round-trip
    const decrypted = decrypt({
      encryptedValue: secret.encryptedValue!,
      iv:             secret.iv!,
      authTag:        secret.authTag!,
    })
    expect(decrypted).toBe('my_secret_value')
  })

  it('throws NotFoundError for unknown slug', async () => {
    vi.mocked(Secret.findOne).mockResolvedValue(null)
    await expect(setSecret('unknown', 'value', userId)).rejects.toThrow(NotFoundError)
  })
})

describe('clearSecret', () => {
  it('clears encrypted fields and sets isSet to false', async () => {
    const { encryptedValue, iv, authTag } = encrypt('existing_value')
    const secret = makeDbSecret({ isSet: true, encryptedValue, iv, authTag })
    vi.mocked(Secret.findOne).mockResolvedValue(secret as any)

    const result = await clearSecret('stripe.secret_key', userId)

    expect(result.isSet).toBe(false)
    expect(secret.isSet).toBe(false)
    expect(secret.encryptedValue).toBeUndefined()
    expect(secret.save).toHaveBeenCalledOnce()
  })
})
