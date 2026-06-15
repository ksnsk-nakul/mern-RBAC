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

vi.mock('../../models/ApiToken.js', () => ({
  ApiToken: {
    create:    vi.fn(),
    find:      vi.fn(),
    findOne:   vi.fn(),
    updateOne: vi.fn(),
  },
}))

import mongoose        from 'mongoose'
import { ApiToken }    from '../../models/ApiToken.js'
import { createToken, listTokens, revokeToken, verifyAndLoadToken } from '../apiTokens.service.js'
import { NotFoundError } from '../../lib/errors.js'

const userId  = new mongoose.Types.ObjectId()
const tokenId = new mongoose.Types.ObjectId()

beforeEach(() => vi.clearAllMocks())

describe('createToken', () => {
  it('creates a token with rawToken starting with rbac_', async () => {
    vi.mocked(ApiToken.create).mockResolvedValue({
      _id:       tokenId,
      name:      'CI Token',
      prefix:    'rbac_abcd1234',
      scopes:    ['users.view'],
      expiresAt: undefined,
      createdAt: new Date(),
    } as any)

    const result = await createToken(userId, 'CI Token', ['users.view'])

    expect(result.rawToken).toMatch(/^rbac_/)
    expect(result.name).toBe('CI Token')
    expect(result.scopes).toEqual(['users.view'])
    expect(ApiToken.create).toHaveBeenCalledOnce()
  })

  it('never stores the raw token — only the hash', async () => {
    vi.mocked(ApiToken.create).mockResolvedValue({
      _id: tokenId, name: 'T', prefix: 'rbac_x', scopes: [], createdAt: new Date()
    } as any)
    await createToken(userId, 'T', [])
    const callArg = vi.mocked(ApiToken.create).mock.calls[0]![0] as any
    expect(callArg.tokenHash).toBeDefined()
    expect(callArg.rawToken).toBeUndefined()
  })
})

describe('revokeToken', () => {
  it('throws NotFoundError for invalid ObjectId format', async () => {
    await expect(revokeToken(userId, 'not-an-objectid')).rejects.toThrow(NotFoundError)
  })

  it('throws NotFoundError if token not found', async () => {
    vi.mocked(ApiToken.updateOne).mockResolvedValue({ matchedCount: 0 } as any)
    await expect(revokeToken(userId, String(tokenId))).rejects.toThrow(NotFoundError)
  })

  it('sets revokedAt on matched token', async () => {
    vi.mocked(ApiToken.updateOne).mockResolvedValue({ matchedCount: 1 } as any)
    await expect(revokeToken(userId, String(tokenId))).resolves.toBeUndefined()
    expect(ApiToken.updateOne).toHaveBeenCalledOnce()
  })
})

describe('verifyAndLoadToken', () => {
  it('returns null for unknown token', async () => {
    vi.mocked(ApiToken.findOne).mockResolvedValue(null)
    const result = await verifyAndLoadToken('rbac_unknown')
    expect(result).toBeNull()
  })

  it('returns userId and scopes for valid token', async () => {
    vi.mocked(ApiToken.findOne).mockResolvedValue({ _id: tokenId, userId, scopes: ['users.view'] } as any)
    vi.mocked(ApiToken.updateOne).mockResolvedValue({} as any)

    const result = await verifyAndLoadToken('rbac_validtoken')
    expect(result).not.toBeNull()
    expect(result!.scopes).toEqual(['users.view'])
    expect(String(result!.userId)).toBe(String(userId))
  })
})
