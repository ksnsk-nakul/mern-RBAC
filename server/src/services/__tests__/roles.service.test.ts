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

vi.mock('../../models/Role.js', () => ({
  Role: {
    find:     vi.fn(),
    findOne:  vi.fn(),
    findById: vi.fn(),
    create:   vi.fn(),
  },
}))
vi.mock('../../models/Permission.js', () => ({
  Permission: { find: vi.fn() },
}))
vi.mock('../../models/UserRole.js', () => ({
  UserRole: {
    aggregate:  vi.fn(),
    updateMany: vi.fn(),
  },
}))

import mongoose from 'mongoose'
import { Role }       from '../../models/Role.js'
import { Permission } from '../../models/Permission.js'
import { UserRole }   from '../../models/UserRole.js'
import { listRoles, createRole, updateRole, deleteRole, setRolePermissions } from '../roles.service.js'
import { NotFoundError, AppError } from '../../lib/errors.js'

const roleId = new mongoose.Types.ObjectId()
const permId = new mongoose.Types.ObjectId()

function makeDbRole(overrides = {}) {
  return {
    _id:                roleId,
    name:               'Viewer',
    slug:               'viewer',
    route:              'viewer',
    color:              '#aabbcc',
    isSubAdmin:         false,
    isDefault:          false,
    isProtected:        false,
    mfaRequired:        false,
    requireIpAllowlist: false,
    permissions:        [],
    save:               vi.fn(),
    deleteOne:          vi.fn(),
    ...overrides,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('listRoles', () => {
  it('returns roles with permission details and user counts', async () => {
    const role = makeDbRole()
    vi.mocked(Role.find).mockReturnValue({
      populate: () => ({ lean: () => [role] }),
    } as any)
    vi.mocked(UserRole.aggregate).mockResolvedValue([{ _id: roleId, count: 3 }])

    const roles = await listRoles()

    expect(roles).toHaveLength(1)
    expect(roles[0].slug).toBe('viewer')
    expect(roles[0].userCount).toBe(3)
    expect(roles[0].permissions).toEqual([])
  })
})

describe('createRole', () => {
  it('throws 409 when slug already exists', async () => {
    vi.mocked(Role.findOne).mockResolvedValue(makeDbRole() as any)

    await expect(createRole({
      name: 'Viewer', slug: 'viewer', route: 'viewer',
      color: '#aabbcc', isSubAdmin: false, mfaRequired: false,
      requireIpAllowlist: false, permissionIds: [],
    })).rejects.toThrow(AppError)
  })

  it('creates role and returns RoleDetail', async () => {
    vi.mocked(Role.findOne).mockResolvedValue(null)
    vi.mocked(Permission.find).mockResolvedValue([])
    const created = makeDbRole()
    vi.mocked(Role.create).mockResolvedValue(created as any)
    vi.mocked(Role.find).mockReturnValue({
      populate: () => ({ lean: () => [created] }),
    } as any)
    vi.mocked(UserRole.aggregate).mockResolvedValue([])

    const result = await createRole({
      name: 'Viewer', slug: 'viewer', route: 'viewer',
      color: '#aabbcc', isSubAdmin: false, mfaRequired: false,
      requireIpAllowlist: false, permissionIds: [],
    })

    expect(result.slug).toBe('viewer')
  })
})

describe('deleteRole', () => {
  it('throws NotFoundError for unknown id', async () => {
    vi.mocked(Role.findById).mockResolvedValue(null)
    await expect(deleteRole(String(roleId))).rejects.toThrow(NotFoundError)
  })

  it('throws AppError for protected role', async () => {
    vi.mocked(Role.findById).mockResolvedValue(makeDbRole({ isProtected: true }) as any)
    await expect(deleteRole(String(roleId))).rejects.toThrow(AppError)
  })

  it('deactivates user-roles and deletes the role', async () => {
    const role = makeDbRole()
    vi.mocked(Role.findById).mockResolvedValue(role as any)
    vi.mocked(UserRole.updateMany).mockResolvedValue({} as any)

    await deleteRole(String(roleId))

    expect(UserRole.updateMany).toHaveBeenCalledWith({ roleId: role._id }, { isActive: false })
    expect(role.deleteOne).toHaveBeenCalledOnce()
  })
})

describe('setRolePermissions', () => {
  it('replaces the permissions array on the role', async () => {
    const role = makeDbRole()
    vi.mocked(Role.findById).mockResolvedValue(role as any)
    vi.mocked(Permission.find).mockResolvedValue([
      { _id: permId, slug: 'users.view', name: 'View Users', mainGroup: 'Users' } as any,
    ])
    vi.mocked(Role.find).mockReturnValue({
      populate: () => ({
        lean: () => [{
          ...role,
          permissions: [{ _id: permId, slug: 'users.view', name: 'View Users', mainGroup: 'Users' }],
        }],
      }),
    } as any)
    vi.mocked(UserRole.aggregate).mockResolvedValue([])

    const result = await setRolePermissions(String(roleId), [String(permId)])

    expect(role.save).toHaveBeenCalledOnce()
    expect(result.permissions).toHaveLength(1)
    expect(result.permissions[0].slug).toBe('users.view')
  })
})
