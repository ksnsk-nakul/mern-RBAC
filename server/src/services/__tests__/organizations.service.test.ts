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
    SEED_ADMIN_EMAIL:       'admin@admin.com',
    SEED_ADMIN_PASSWORD:    'changeme',
  },
}))

const { mockOrgCreate, mockOrgFindOne, mockOrgFind, mockOrgFindById, mockOrgCountDocuments,
        mockOuCreate, mockOuFindOne, mockOuFind, mockOuFindOneAndUpdate, mockOuDeleteMany, mockOuDeleteOne,
        mockUserUpdateOne, mockOrgFindByIdAndUpdate, mockOrgFindByIdDelete } = vi.hoisted(() => ({
  mockOrgCreate:            vi.fn(),
  mockOrgFindOne:           vi.fn(),
  mockOrgFind:              vi.fn(),
  mockOrgFindById:          vi.fn(),
  mockOrgCountDocuments:    vi.fn(),
  mockOuCreate:             vi.fn(),
  mockOuFindOne:            vi.fn(),
  mockOuFind:               vi.fn(),
  mockOuFindOneAndUpdate:   vi.fn(),
  mockOuDeleteMany:         vi.fn(),
  mockOuDeleteOne:          vi.fn(),
  mockUserUpdateOne:        vi.fn(),
  mockOrgFindByIdAndUpdate: vi.fn(),
  mockOrgFindByIdDelete:    vi.fn(),
}))

vi.mock('../../models/Organization.js', () => ({
  Organization: {
    create:             mockOrgCreate,
    findOne:            mockOrgFindOne,
    find:               mockOrgFind,
    findById:           mockOrgFindById,
    findByIdAndUpdate:  mockOrgFindByIdAndUpdate,
    countDocuments:     mockOrgCountDocuments,
  },
}))
vi.mock('../../models/OrganizationUser.js', () => ({
  OrganizationUser: {
    create:           mockOuCreate,
    findOne:          mockOuFindOne,
    find:             mockOuFind,
    findOneAndUpdate: mockOuFindOneAndUpdate,
    deleteMany:       mockOuDeleteMany,
    deleteOne:        mockOuDeleteOne,
  },
}))
vi.mock('../../models/User.js', () => ({
  User: { updateOne: mockUserUpdateOne, updateMany: vi.fn() },
}))

import mongoose from 'mongoose'
import crypto from 'crypto'
import {
  createOrg, getOrg, inviteMember, acceptInvite, addMember, removeMember, switchOrg, listMyOrgs,
} from '../organizations.service.js'
import { AppError, NotFoundError } from '../../lib/errors.js'

const actorId = new mongoose.Types.ObjectId()
const orgId   = new mongoose.Types.ObjectId()
const userId  = new mongoose.Types.ObjectId()

beforeEach(() => { vi.clearAllMocks() })

describe('createOrg', () => {
  it('generates slug from name and creates org with actorId as createdBy', async () => {
    const fakeOrg = { _id: orgId, name: 'Acme Corp', slug: 'acme-corp', createdBy: actorId }
    mockOrgFindOne.mockResolvedValue(null)
    mockOrgCreate.mockResolvedValue(fakeOrg)
    mockOuCreate.mockResolvedValue({})

    const result = await createOrg({ name: 'Acme Corp' }, actorId)

    expect(mockOrgCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Acme Corp', slug: 'acme-corp', createdBy: actorId }),
    )
    expect(result.slug).toBe('acme-corp')
  })

  it('throws if slug already taken', async () => {
    mockOrgFindOne.mockResolvedValue({ slug: 'acme-corp' })
    await expect(createOrg({ name: 'Acme Corp' }, actorId)).rejects.toThrow('slug')
  })
})

describe('inviteMember', () => {
  it('returns a raw token and stores the SHA-256 hash', async () => {
    mockOuFindOne.mockResolvedValue(null)
    mockOuCreate.mockResolvedValue({})

    const { invitationToken } = await inviteMember(orgId, userId, 'member', actorId)

    expect(typeof invitationToken).toBe('string')
    expect(invitationToken.length).toBeGreaterThan(32)

    const hash = crypto.createHash('sha256').update(invitationToken).digest('hex')
    expect(mockOuCreate).toHaveBeenCalledWith(
      expect.objectContaining({ invitationToken: hash, status: 'pending', orgRole: 'member' }),
    )
  })

  it('throws if user is already a member', async () => {
    mockOuFindOne.mockResolvedValue({ status: 'active' })
    await expect(inviteMember(orgId, userId, 'member', actorId)).rejects.toThrow()
  })
})

describe('acceptInvite', () => {
  it('sets status to active and clears invitationToken', async () => {
    const rawToken = 'valid-raw-token-string'
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const fakeMembership = {
      _id: new mongoose.Types.ObjectId(),
      orgId,
      userId,
      orgRole: 'member',
      status: 'active',
    }
    mockOuFindOneAndUpdate.mockResolvedValue(fakeMembership)

    await acceptInvite(rawToken, userId)

    expect(mockOuFindOneAndUpdate).toHaveBeenCalledWith(
      { invitationToken: tokenHash, status: 'pending', userId },
      { $set: { status: 'active' }, $unset: { invitationToken: '' } },
      { new: true },
    )
  })

  it('throws NotFoundError if token is invalid or already used', async () => {
    mockOuFindOneAndUpdate.mockResolvedValue(null)
    await expect(acceptInvite('bad-token', userId)).rejects.toThrow(NotFoundError)
  })
})

describe('removeMember', () => {
  it('throws AppError when trying to remove the last owner', async () => {
    mockOuFindOne.mockResolvedValueOnce({ orgRole: 'owner', status: 'active' })
    mockOuFind.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) })

    await expect(removeMember(orgId, userId)).rejects.toThrow(AppError)
  })

  it('succeeds when removing a non-owner member', async () => {
    mockOuFindOne.mockResolvedValueOnce({ orgRole: 'member', status: 'active' })
    mockOuDeleteOne.mockResolvedValue({ deletedCount: 1 })

    await removeMember(orgId, userId)

    expect(mockOuDeleteOne).toHaveBeenCalledWith({ orgId, userId })
  })
})

describe('switchOrg', () => {
  it('updates user currentOrganization', async () => {
    mockUserUpdateOne.mockResolvedValue({ modifiedCount: 1 })
    await switchOrg(userId, orgId)
    expect(mockUserUpdateOne).toHaveBeenCalledWith(
      { _id: userId },
      { $set: { currentOrganization: orgId } },
    )
  })

  it('clears currentOrganization when null passed', async () => {
    mockUserUpdateOne.mockResolvedValue({ modifiedCount: 1 })
    await switchOrg(userId, null)
    expect(mockUserUpdateOne).toHaveBeenCalledWith(
      { _id: userId },
      { $unset: { currentOrganization: '' } },
    )
  })
})

describe('listMyOrgs', () => {
  it('returns active memberships with org details', async () => {
    const fakeOrg = { _id: orgId, name: 'Acme', slug: 'acme', createdAt: new Date() }
    mockOuFind.mockReturnValue({
      populate: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { orgId: fakeOrg, orgRole: 'owner', status: 'active' },
        ]),
      }),
    })

    const result = await listMyOrgs(userId)

    expect(result).toHaveLength(1)
    expect(result[0]!.orgRole).toBe('owner')
  })
})
