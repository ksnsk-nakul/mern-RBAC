import { describe, it, expect, vi, beforeEach } from 'vitest'

// Set env before imports
process.env.JWT_ACCESS_SECRET  = 'test_access_secret_that_is_at_least_32_chars_long'
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_that_is_at_least_32_chars_long'
process.env.SECRETS_ENCRYPTION_KEY = '0'.repeat(64)
process.env.MONGODB_URI = 'mongodb://localhost:27017/test'

// Mock env config to avoid zod validation at import time
vi.mock('../../config/env.js', () => ({
  env: {
    JWT_ACCESS_SECRET:      'test_access_secret_that_is_at_least_32_chars_long',
    JWT_REFRESH_SECRET:     'test_refresh_secret_that_is_at_least_32_chars_long',
    SECRETS_ENCRYPTION_KEY: '0'.repeat(64),
    MONGODB_URI:            'mongodb://localhost:27017/test',
    NODE_ENV:               'test',
    PORT:                   5000,
    AI_SERVICE_URL:         'http://ai:8001',
    SEED_ADMIN_EMAIL:       'admin@admin.com',
    SEED_ADMIN_PASSWORD:    'changeme',
  },
}))

// Mock Mongoose models
vi.mock('../../models/User.js', () => ({
  User: { findOne: vi.fn() },
}))
vi.mock('../../models/Role.js', () => ({
  Role: {
    findById: vi.fn().mockReturnValue({ populate: vi.fn() }),
  },
}))
vi.mock('../../models/UserRole.js', () => ({
  UserRole: { findOne: vi.fn() },
}))
vi.mock('../../models/RefreshToken.js', () => ({
  RefreshToken: {
    create:    vi.fn(),
    findOne:   vi.fn(),
    deleteOne: vi.fn(),
  },
}))

import bcrypt from 'bcryptjs'
import { User }         from '../../models/User.js'
import { Role }         from '../../models/Role.js'
import { UserRole }     from '../../models/UserRole.js'
import { RefreshToken } from '../../models/RefreshToken.js'
import { loginWithRole, refreshTokens, revokeRefreshToken } from '../auth.service.js'
import { signRefreshToken, hashToken } from '../../lib/jwt.js'
import { AuthError, ForbiddenError } from '../../lib/errors.js'
import mongoose from 'mongoose'

const mockRoleId = new mongoose.Types.ObjectId()
const mockUserId = new mongoose.Types.ObjectId()

const mockRole = {
  _id:         mockRoleId,
  name:        'Super Admin',
  slug:        'super_admin',
  route:       'admin',
  color:       '#6366f1',
  permissions: [],
}

async function makeUser(overrides = {}) {
  const password = await bcrypt.hash('secret123', 10)
  return {
    _id:       mockUserId,
    name:      'Test User',
    email:     'test@example.com',
    password,
    isFounder: false,
    avatarUrl: undefined,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loginWithRole', () => {
  it('returns AuthResult with tokens on valid credentials', async () => {
    const user = await makeUser()
    vi.mocked(User.findOne).mockResolvedValue(user as any)
    vi.mocked(UserRole.findOne).mockResolvedValue({ userId: mockUserId, roleId: mockRoleId } as any)
    vi.mocked(Role.findById).mockReturnValue({ populate: vi.fn().mockResolvedValue(mockRole) } as any)
    vi.mocked(RefreshToken.create).mockResolvedValue({} as any)

    const result = await loginWithRole('test@example.com', 'secret123', mockRole as any)

    expect(result.user.email).toBe('test@example.com')
    expect(result.role.slug).toBe('super_admin')
    expect(result.redirectTo).toBe('/admin')
    expect(typeof result.accessToken).toBe('string')
    expect(typeof result.refreshToken).toBe('string')
  })

  it('throws AuthError for unknown email', async () => {
    vi.mocked(User.findOne).mockResolvedValue(null)

    await expect(loginWithRole('unknown@example.com', 'pass', mockRole as any))
      .rejects.toThrow(AuthError)
  })

  it('throws AuthError for wrong password', async () => {
    const user = await makeUser()
    vi.mocked(User.findOne).mockResolvedValue(user as any)

    await expect(loginWithRole('test@example.com', 'wrongpassword', mockRole as any))
      .rejects.toThrow(AuthError)
  })

  it('throws AuthError for Google-only account (no password)', async () => {
    const user = await makeUser({ password: undefined })
    vi.mocked(User.findOne).mockResolvedValue(user as any)

    await expect(loginWithRole('test@example.com', 'anypass', mockRole as any))
      .rejects.toThrow(AuthError)
  })

  it('throws ForbiddenError when user does not hold the role', async () => {
    const user = await makeUser()
    vi.mocked(User.findOne).mockResolvedValue(user as any)
    vi.mocked(UserRole.findOne).mockResolvedValue(null)

    await expect(loginWithRole('test@example.com', 'secret123', mockRole as any))
      .rejects.toThrow(ForbiddenError)
  })

  it('saves a refresh token hash to the database', async () => {
    const user = await makeUser()
    vi.mocked(User.findOne).mockResolvedValue(user as any)
    vi.mocked(UserRole.findOne).mockResolvedValue({ userId: mockUserId, roleId: mockRoleId } as any)
    vi.mocked(Role.findById).mockReturnValue({ populate: vi.fn().mockResolvedValue(mockRole) } as any)
    vi.mocked(RefreshToken.create).mockResolvedValue({} as any)

    await loginWithRole('test@example.com', 'secret123', mockRole as any)

    expect(RefreshToken.create).toHaveBeenCalledOnce()
    const createArg = vi.mocked(RefreshToken.create).mock.calls[0][0] as any
    expect(createArg.userId.toString()).toBe(mockUserId.toString())
    expect(typeof createArg.tokenHash).toBe('string')
    expect(createArg.tokenHash).toHaveLength(64)
  })
})

describe('refreshTokens', () => {
  it('returns new tokens and rotates the refresh token', async () => {
    const raw    = signRefreshToken({ sub: String(mockUserId), roleId: String(mockRoleId) })
    const stored = { tokenHash: hashToken(raw), userId: mockUserId, deleteOne: vi.fn() }

    vi.mocked(RefreshToken.findOne).mockResolvedValue(stored as any)
    vi.mocked(Role.findById).mockReturnValue({ populate: vi.fn().mockResolvedValue(mockRole) } as any)
    vi.mocked(RefreshToken.create).mockResolvedValue({} as any)

    const result = await refreshTokens(raw)

    expect(typeof result.accessToken).toBe('string')
    expect(typeof result.refreshToken).toBe('string')
    expect(stored.deleteOne).toHaveBeenCalledOnce()
    expect(RefreshToken.create).toHaveBeenCalledOnce()
  })

  it('throws AuthError for invalid JWT', async () => {
    await expect(refreshTokens('invalid.token.here')).rejects.toThrow(AuthError)
  })

  it('throws AuthError when token is not found in DB (revoked)', async () => {
    const raw = signRefreshToken({ sub: String(mockUserId), roleId: String(mockRoleId) })
    vi.mocked(RefreshToken.findOne).mockResolvedValue(null)

    await expect(refreshTokens(raw)).rejects.toThrow(AuthError)
  })
})

describe('revokeRefreshToken', () => {
  it('deletes the token hash from the database', async () => {
    vi.mocked(RefreshToken.deleteOne).mockResolvedValue({ deletedCount: 1 } as any)
    const raw = signRefreshToken({ sub: String(mockUserId), roleId: String(mockRoleId) })

    await revokeRefreshToken(raw)

    expect(RefreshToken.deleteOne).toHaveBeenCalledWith({ tokenHash: hashToken(raw) })
  })

  it('does nothing when called with an empty string', async () => {
    await revokeRefreshToken('')
    expect(RefreshToken.deleteOne).not.toHaveBeenCalled()
  })
})
