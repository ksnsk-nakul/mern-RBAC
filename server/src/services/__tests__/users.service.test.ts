import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.JWT_ACCESS_SECRET      = 'test_access_secret_that_is_at_least_32_chars_long'
process.env.JWT_REFRESH_SECRET     = 'test_refresh_secret_that_is_at_least_32_chars_long'
process.env.SECRETS_ENCRYPTION_KEY = '0'.repeat(64)
process.env.MONGODB_URI            = 'mongodb://localhost:27017/test'

vi.mock('../../config/env.js', () => ({
  env: {
    MONGODB_URI:            'mongodb://localhost:27017/test',
    JWT_ACCESS_SECRET:      'test_access_secret_that_is_at_least_32_chars_long',
    JWT_REFRESH_SECRET:     'test_refresh_secret_that_is_at_least_32_chars_long',
    SECRETS_ENCRYPTION_KEY: '0'.repeat(64),
    NODE_ENV:               'test',
    PORT:                   5000,
    AI_SERVICE_URL:         'http://ai:8001',
    SEED_ADMIN_EMAIL:       'admin@admin.com',
    SEED_ADMIN_PASSWORD:    'changeme',
  },
}))

vi.mock('../../models/User.js', () => ({
  User: {
    findOne:        vi.fn(),
    findById:       vi.fn(),
    find:           vi.fn(),
    countDocuments: vi.fn(),
    create:         vi.fn(),
  },
}))
vi.mock('../../models/UserRole.js', () => ({
  UserRole: {
    find:       vi.fn(),
    create:     vi.fn(),
    updateMany: vi.fn(),
  },
}))
vi.mock('../../models/Role.js', () => ({
  Role: { find: vi.fn() },
}))

import mongoose from 'mongoose'
import { User }     from '../../models/User.js'
import { UserRole } from '../../models/UserRole.js'
import { listUsers, getUser, createUser, updateUser, softDeleteUser } from '../users.service.js'
import { NotFoundError, AppError } from '../../lib/errors.js'

const uid1 = new mongoose.Types.ObjectId()
const rid1 = new mongoose.Types.ObjectId()

function makeDbUser(overrides = {}) {
  return {
    _id:       uid1,
    name:      'Alice',
    email:     'alice@example.com',
    avatarUrl: undefined,
    isFounder: false,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    save:      vi.fn(),
    ...overrides,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('listUsers', () => {
  it('returns paginated users with their roles', async () => {
    const user = makeDbUser()
    vi.mocked(User.find).mockReturnValue({
      skip: () => ({ limit: () => ({ sort: () => ({ lean: () => [user] }) }) }),
    } as any)
    vi.mocked(User.countDocuments).mockResolvedValue(1)
    vi.mocked(UserRole.find).mockReturnValue({
      populate: () => ({
        lean: () => [{
          userId: uid1,
          roleId: { _id: rid1, name: 'Admin', slug: 'admin', color: '#6366f1' },
        }],
      }),
    } as any)

    const { users, total } = await listUsers({})

    expect(total).toBe(1)
    expect(users).toHaveLength(1)
    expect(users[0].email).toBe('alice@example.com')
    expect(users[0].roles).toHaveLength(1)
    expect(users[0].roles[0].slug).toBe('admin')
  })
})

describe('getUser', () => {
  it('throws NotFoundError for unknown id', async () => {
    vi.mocked(User.findById).mockReturnValue({ lean: () => null } as any)
    await expect(getUser(String(uid1))).rejects.toThrow(NotFoundError)
  })

  it('returns user with populated roles', async () => {
    const user = makeDbUser()
    vi.mocked(User.findById).mockReturnValue({ lean: () => user } as any)
    vi.mocked(UserRole.find).mockReturnValue({
      populate: () => ({ lean: () => [] }),
    } as any)

    const result = await getUser(String(uid1))
    expect(result.name).toBe('Alice')
    expect(result.roles).toEqual([])
  })
})

describe('createUser', () => {
  it('throws 409 when email already exists', async () => {
    vi.mocked(User.findOne).mockResolvedValue(makeDbUser() as any)
    await expect(
      createUser({ name: 'Bob', email: 'alice@example.com', password: 'pass1234', isFounder: false, roleIds: [] }),
    ).rejects.toThrow(AppError)
  })

  it('creates user and returns UserListItem', async () => {
    vi.mocked(User.findOne).mockResolvedValue(null)
    const created = makeDbUser({ name: 'Bob', email: 'bob@example.com' })
    vi.mocked(User.create).mockResolvedValue(created as any)
    vi.mocked(User.findById).mockReturnValue({ lean: () => created } as any)
    vi.mocked(UserRole.find).mockReturnValue({ populate: () => ({ lean: () => [] }) } as any)

    const result = await createUser({ name: 'Bob', email: 'bob@example.com', password: 'pass1234', isFounder: false, roleIds: [] })
    expect(result.email).toBe('bob@example.com')
  })
})

describe('updateUser', () => {
  it('throws NotFoundError for unknown id', async () => {
    vi.mocked(User.findById).mockResolvedValue(null)
    await expect(updateUser(String(uid1), { name: 'New' })).rejects.toThrow(NotFoundError)
  })

  it('updates name and returns updated user', async () => {
    const user = makeDbUser()
    vi.mocked(User.findById)
      .mockResolvedValueOnce(user as any)
      .mockReturnValueOnce({ lean: () => ({ ...user, name: 'Updated' }) } as any)
    vi.mocked(UserRole.find).mockReturnValue({ populate: () => ({ lean: () => [] }) } as any)

    const result = await updateUser(String(uid1), { name: 'Updated' })
    expect(user.save).toHaveBeenCalledOnce()
    expect(result.name).toBe('Updated')
  })
})

describe('softDeleteUser', () => {
  it('throws if deleting own account', async () => {
    const user = makeDbUser({ _id: uid1 })
    vi.mocked(User.findById).mockResolvedValue(user as any)
    await expect(softDeleteUser(String(uid1), uid1)).rejects.toThrow(AppError)
  })

  it('sets deletedAt and deactivates user roles', async () => {
    const deletorId = new mongoose.Types.ObjectId()
    const user = makeDbUser()
    vi.mocked(User.findById).mockResolvedValue(user as any)
    vi.mocked(UserRole.updateMany).mockResolvedValue({} as any)

    await softDeleteUser(String(uid1), deletorId)

    expect(user.deletedAt).toBeTruthy()
    expect(user.save).toHaveBeenCalledOnce()
    expect(UserRole.updateMany).toHaveBeenCalledWith({ userId: user._id }, { isActive: false })
  })
})
