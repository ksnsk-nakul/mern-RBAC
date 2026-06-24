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

const { mockCreate, mockFind, mockFindById, mockCountDocuments,
        mockAssignRole, mockGetRole, mockSetRolePermissions } = vi.hoisted(() => ({
  mockCreate:             vi.fn(),
  mockFind:               vi.fn(),
  mockFindById:           vi.fn(),
  mockCountDocuments:     vi.fn(),
  mockAssignRole:         vi.fn(),
  mockGetRole:            vi.fn(),
  mockSetRolePermissions: vi.fn(),
}))

vi.mock('../../models/ApprovalRequest.js', () => ({
  ApprovalRequest: { create: mockCreate, find: mockFind, findById: mockFindById, countDocuments: mockCountDocuments },
}))
vi.mock('../userRoles.service.js', () => ({ assignRole: mockAssignRole }))
vi.mock('../roles.service.js', () => ({ getRole: mockGetRole, setRolePermissions: mockSetRolePermissions }))

import mongoose from 'mongoose'
import { submitRequest, listMyRequests, listRequests, approveRequest, rejectRequest } from '../approvalRequests.service.js'
import { NotFoundError, AppError } from '../../lib/errors.js'

const requestId = new mongoose.Types.ObjectId()
const userId    = new mongoose.Types.ObjectId()
const roleId    = new mongoose.Types.ObjectId()
const permId    = new mongoose.Types.ObjectId()
const approverId = new mongoose.Types.ObjectId()

beforeEach(() => { vi.clearAllMocks() })

describe('submitRequest', () => {
  it('forces targetUserId to the requester for role_assignment, ignoring any client-supplied value', async () => {
    mockCreate.mockResolvedValue({
      _id: requestId, requestType: 'role_assignment', requestedBy: userId, targetUserId: userId,
      targetRoleId: roleId, status: 'pending', createdAt: new Date(),
    })

    await submitRequest({ requestType: 'role_assignment', targetRoleId: String(roleId), reason: 'need access' }, userId)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ requestType: 'role_assignment', requestedBy: userId, targetUserId: userId, targetRoleId: roleId }),
    )
  })

  it('creates a permission_grant request with targetPermissionId and no targetUserId', async () => {
    mockCreate.mockResolvedValue({
      _id: requestId, requestType: 'permission_grant', requestedBy: userId,
      targetRoleId: roleId, targetPermissionId: permId, status: 'pending', createdAt: new Date(),
    })

    await submitRequest({ requestType: 'permission_grant', targetRoleId: String(roleId), targetPermissionId: String(permId) }, userId)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ requestType: 'permission_grant', targetRoleId: roleId, targetPermissionId: permId, targetUserId: undefined }),
    )
  })

  it('throws AppError if permission_grant is submitted without targetPermissionId', async () => {
    await expect(submitRequest({ requestType: 'permission_grant', targetRoleId: String(roleId) }, userId))
      .rejects.toThrow(AppError)
  })
})

describe('listMyRequests', () => {
  it('returns the requester\'s own requests', async () => {
    mockFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { _id: requestId, requestType: 'role_assignment', requestedBy: userId, targetRoleId: roleId, status: 'pending', createdAt: new Date() },
        ]),
      }),
    })

    const result = await listMyRequests(userId)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe(String(requestId))
    expect(result[0]!.status).toBe('pending')
  })
})

describe('listRequests', () => {
  it('filters by status when provided', async () => {
    mockFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
        }),
      }),
    })
    mockCountDocuments.mockResolvedValue(0)

    await listRequests({ status: 'pending', page: 1, limit: 20 })

    expect(mockFind).toHaveBeenCalledWith({ status: 'pending' })
  })

  it('returns the correct pagination shape', async () => {
    mockFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([
              { _id: requestId, requestType: 'role_assignment', requestedBy: userId, targetRoleId: roleId, status: 'pending', createdAt: new Date() },
            ]),
          }),
        }),
      }),
    })
    mockCountDocuments.mockResolvedValue(1)

    const result = await listRequests({ status: 'pending', page: 1, limit: 20 })

    expect(result.total).toBe(1)
    expect(result.pages).toBe(1)
    expect(result.requests).toHaveLength(1)
    expect(result.requests[0]!.id).toBe(String(requestId))
  })

  it('returns pages: 1 when there are no results', async () => {
    mockFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
        }),
      }),
    })
    mockCountDocuments.mockResolvedValue(0)

    const result = await listRequests({ page: 1, limit: 20 })

    expect(result.total).toBe(0)
    expect(result.pages).toBe(1)
  })
})

describe('approveRequest', () => {
  it('throws NotFoundError when the request does not exist', async () => {
    mockFindById.mockResolvedValue(null)
    await expect(approveRequest(String(requestId), approverId)).rejects.toThrow(NotFoundError)
  })

  it('throws AppError when the request is not pending', async () => {
    mockFindById.mockResolvedValue({ status: 'approved' })
    await expect(approveRequest(String(requestId), approverId)).rejects.toThrow(AppError)
  })

  it('calls assignRole for a role_assignment request and marks it approved', async () => {
    const req = {
      _id: requestId, status: 'pending', requestType: 'role_assignment',
      targetUserId: userId, targetRoleId: roleId, save: vi.fn(),
      approvedBy: undefined as typeof approverId | undefined,
      decisionNote: undefined as string | undefined,
      decidedAt: undefined as Date | undefined,
    }
    mockFindById.mockResolvedValue(req)
    mockAssignRole.mockResolvedValue([])

    await approveRequest(String(requestId), approverId, 'looks good')

    expect(mockAssignRole).toHaveBeenCalledWith(String(userId), String(roleId), approverId)
    expect(req.status).toBe('approved')
    expect(req.approvedBy).toBe(approverId)
    expect(req.decisionNote).toBe('looks good')
    expect(req.save).toHaveBeenCalled()
  })

  it('merges the permission into the role for a permission_grant request and marks it approved', async () => {
    const req = {
      _id: requestId, status: 'pending', requestType: 'permission_grant',
      targetRoleId: roleId, targetPermissionId: permId, save: vi.fn(),
    }
    mockFindById.mockResolvedValue(req)
    mockGetRole.mockResolvedValue({ permissions: [{ id: 'existing-perm-id' }] })
    mockSetRolePermissions.mockResolvedValue({})

    await approveRequest(String(requestId), approverId)

    expect(mockSetRolePermissions).toHaveBeenCalledWith(String(roleId), ['existing-perm-id', String(permId)])
    expect(req.status).toBe('approved')
  })

  it('does not merge a duplicate permission already on the role', async () => {
    const req = {
      _id: requestId, status: 'pending', requestType: 'permission_grant',
      targetRoleId: roleId, targetPermissionId: permId, save: vi.fn(),
    }
    mockFindById.mockResolvedValue(req)
    mockGetRole.mockResolvedValue({ permissions: [{ id: String(permId) }] })
    mockSetRolePermissions.mockResolvedValue({})

    await approveRequest(String(requestId), approverId)

    expect(mockSetRolePermissions).toHaveBeenCalledWith(String(roleId), [String(permId)])
  })

  it('leaves the request pending if the underlying action throws', async () => {
    const req = {
      _id: requestId, status: 'pending', requestType: 'role_assignment',
      targetUserId: userId, targetRoleId: roleId, save: vi.fn(),
    }
    mockFindById.mockResolvedValue(req)
    mockAssignRole.mockRejectedValue(new Error('role deleted'))

    await expect(approveRequest(String(requestId), approverId)).rejects.toThrow('role deleted')

    expect(req.status).toBe('pending')
    expect(req.save).not.toHaveBeenCalled()
  })
})

describe('rejectRequest', () => {
  it('throws NotFoundError when the request does not exist', async () => {
    mockFindById.mockResolvedValue(null)
    await expect(rejectRequest(String(requestId), approverId)).rejects.toThrow(NotFoundError)
  })

  it('marks the request rejected with no side effect on roles', async () => {
    const req = {
      _id: requestId, status: 'pending', save: vi.fn(),
      decisionNote: undefined as string | undefined,
      approvedBy: undefined as typeof approverId | undefined,
      decidedAt: undefined as Date | undefined,
    }
    mockFindById.mockResolvedValue(req)

    await rejectRequest(String(requestId), approverId, 'not needed')

    expect(req.status).toBe('rejected')
    expect(req.decisionNote).toBe('not needed')
    expect(req.save).toHaveBeenCalled()
    expect(mockAssignRole).not.toHaveBeenCalled()
    expect(mockSetRolePermissions).not.toHaveBeenCalled()
  })
})
