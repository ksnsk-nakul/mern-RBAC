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

const { mockCreate, mockFind, mockFindById, mockDeleteOne } = vi.hoisted(() => ({
  mockCreate:    vi.fn(),
  mockFind:      vi.fn(),
  mockFindById:  vi.fn(),
  mockDeleteOne: vi.fn(),
}))

vi.mock('../../models/RoleTemplate.js', () => ({
  RoleTemplate: { create: mockCreate, find: mockFind, findById: mockFindById, deleteOne: mockDeleteOne },
}))

import mongoose from 'mongoose'
import { createTemplate, listTemplates, deleteTemplate } from '../roleTemplates.service.js'
import { NotFoundError } from '../../lib/errors.js'

const templateId = new mongoose.Types.ObjectId()
const actorId    = new mongoose.Types.ObjectId()
const permId     = new mongoose.Types.ObjectId()

beforeEach(() => { vi.clearAllMocks() })

describe('createTemplate', () => {
  it('creates a template with the given name, description, and permissionIds', async () => {
    mockCreate.mockResolvedValue({
      _id: templateId, name: 'Editor Basics', description: 'Common editor perms',
      permissionIds: [permId], createdAt: new Date(),
    })

    const result = await createTemplate({ name: 'Editor Basics', description: 'Common editor perms', permissionIds: [String(permId)] }, actorId)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Editor Basics', description: 'Common editor perms', createdBy: actorId }),
    )
    expect(result.id).toBe(String(templateId))
    expect(result.permissionIds).toEqual([String(permId)])
  })
})

describe('listTemplates', () => {
  it('returns all templates sorted by name', async () => {
    mockFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { _id: templateId, name: 'Editor Basics', description: 'x', permissionIds: [permId], createdAt: new Date() },
        ]),
      }),
    })

    const result = await listTemplates()

    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('Editor Basics')
  })
})

describe('deleteTemplate', () => {
  it('throws NotFoundError when nothing was deleted', async () => {
    mockDeleteOne.mockResolvedValue({ deletedCount: 0 })
    await expect(deleteTemplate(String(templateId))).rejects.toThrow(NotFoundError)
  })

  it('succeeds when a template was deleted', async () => {
    mockDeleteOne.mockResolvedValue({ deletedCount: 1 })
    await expect(deleteTemplate(String(templateId))).resolves.toBeUndefined()
  })
})
