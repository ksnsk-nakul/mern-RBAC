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

const { mockEndpointCreate, mockEndpointFind, mockEndpointFindOneAndUpdate, mockEndpointDeleteOne,
        mockEndpointUpdateOne, mockDeliveryFind, mockDeliveryCountDocuments } = vi.hoisted(() => ({
  mockEndpointCreate:           vi.fn(),
  mockEndpointFind:             vi.fn(),
  mockEndpointFindOneAndUpdate: vi.fn(),
  mockEndpointDeleteOne:        vi.fn(),
  mockEndpointUpdateOne:        vi.fn(),
  mockDeliveryFind:             vi.fn(),
  mockDeliveryCountDocuments:   vi.fn(),
}))

vi.mock('../../models/WebhookEndpoint.js', () => ({
  WEBHOOK_EVENT_TYPES: ['login.success', 'login.failed', 'mfa.enabled', 'mfa.disabled', 'secret.revealed', 'user.role_changed'],
  WebhookEndpoint: {
    create:           mockEndpointCreate,
    find:             mockEndpointFind,
    findOneAndUpdate: mockEndpointFindOneAndUpdate,
    deleteOne:        mockEndpointDeleteOne,
    updateOne:        mockEndpointUpdateOne,
  },
}))
vi.mock('../../models/WebhookDelivery.js', () => ({
  WebhookDelivery: {
    find:             mockDeliveryFind,
    countDocuments:   mockDeliveryCountDocuments,
  },
}))
vi.mock('../../models/OrganizationUser.js', () => ({
  OrganizationUser: { find: vi.fn() },
}))

import mongoose from 'mongoose'
import { createEndpoint, listEndpoints, updateEndpoint, deleteEndpoint, regenerateSecret, listDeliveries } from '../webhooks.service.js'
import { NotFoundError } from '../../lib/errors.js'

const orgId    = new mongoose.Types.ObjectId()
const actorId  = new mongoose.Types.ObjectId()
const endpointId = new mongoose.Types.ObjectId()

beforeEach(() => { vi.clearAllMocks() })

describe('createEndpoint', () => {
  it('encrypts a generated secret and returns the raw secret once', async () => {
    mockEndpointCreate.mockResolvedValue({
      _id: endpointId, url: 'https://example.com/hook', events: ['login.success'], active: true,
    })

    const result = await createEndpoint(orgId, { url: 'https://example.com/hook', events: ['login.success'] }, actorId)

    expect(mockEndpointCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId, url: 'https://example.com/hook', events: ['login.success'], active: true, createdBy: actorId,
        encryptedValue: expect.any(String),
        iv:             expect.any(String),
        authTag:        expect.any(String),
      }),
    )
    expect(typeof result.secret).toBe('string')
    expect(result.secret.length).toBeGreaterThan(32)
    expect(result.id).toBe(String(endpointId))
  })
})

describe('listEndpoints', () => {
  it('excludes secret fields from results', async () => {
    mockEndpointFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            { _id: endpointId, url: 'https://example.com/hook', events: ['login.success'], active: true, createdAt: new Date() },
          ]),
        }),
      }),
    })

    const result = await listEndpoints(orgId)

    expect(result).toHaveLength(1)
    expect(result[0]).not.toHaveProperty('encryptedValue')
    expect(result[0]!.url).toBe('https://example.com/hook')
  })
})

describe('updateEndpoint', () => {
  it('throws NotFoundError for an invalid id', async () => {
    await expect(updateEndpoint(orgId, 'not-an-id', { active: false })).rejects.toThrow(NotFoundError)
  })

  it('throws NotFoundError if no matching endpoint in this org', async () => {
    mockEndpointFindOneAndUpdate.mockReturnValue({ select: vi.fn().mockResolvedValue(null) })
    await expect(updateEndpoint(orgId, String(endpointId), { active: false })).rejects.toThrow(NotFoundError)
  })
})

describe('deleteEndpoint', () => {
  it('throws NotFoundError when nothing was deleted', async () => {
    mockEndpointDeleteOne.mockResolvedValue({ deletedCount: 0 })
    await expect(deleteEndpoint(orgId, String(endpointId))).rejects.toThrow(NotFoundError)
  })

  it('succeeds when a row was deleted', async () => {
    mockEndpointDeleteOne.mockResolvedValue({ deletedCount: 1 })
    await expect(deleteEndpoint(orgId, String(endpointId))).resolves.toBeUndefined()
  })
})

describe('regenerateSecret', () => {
  it('throws NotFoundError when no endpoint matched', async () => {
    mockEndpointUpdateOne.mockResolvedValue({ matchedCount: 0 })
    await expect(regenerateSecret(orgId, String(endpointId))).rejects.toThrow(NotFoundError)
  })

  it('returns a new raw secret on success', async () => {
    mockEndpointUpdateOne.mockResolvedValue({ matchedCount: 1 })
    const result = await regenerateSecret(orgId, String(endpointId))
    expect(typeof result.secret).toBe('string')
    expect(result.secret.length).toBeGreaterThan(32)
  })
})

describe('listDeliveries', () => {
  it('returns paginated delivery items', async () => {
    mockDeliveryFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([
              { _id: new mongoose.Types.ObjectId(), event: 'login.success', status: 'success', attempts: 1, responseStatus: 200, createdAt: new Date() },
            ]),
          }),
        }),
      }),
    })
    mockDeliveryCountDocuments.mockResolvedValue(1)

    const result = await listDeliveries(String(endpointId), { page: 1, limit: 20 })

    expect(result.total).toBe(1)
    expect(result.deliveries).toHaveLength(1)
    expect(result.deliveries[0]!.status).toBe('success')
  })
})
