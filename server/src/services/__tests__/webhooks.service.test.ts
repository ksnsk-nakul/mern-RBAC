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

const { mockEndpointCreate, mockEndpointFind, mockEndpointFindById, mockEndpointFindOneAndUpdate, mockEndpointDeleteOne,
        mockEndpointUpdateOne, mockDeliveryCreate, mockDeliveryFind, mockDeliveryFindById, mockDeliveryFindOne, mockDeliveryUpdateOne,
        mockDeliveryCountDocuments, mockOuFind, mockDnsLookup } = vi.hoisted(() => ({
  mockEndpointCreate:           vi.fn(),
  mockEndpointFind:             vi.fn(),
  mockEndpointFindById:         vi.fn(),
  mockEndpointFindOneAndUpdate: vi.fn(),
  mockEndpointDeleteOne:        vi.fn(),
  mockEndpointUpdateOne:        vi.fn(),
  mockDeliveryCreate:           vi.fn(),
  mockDeliveryFind:             vi.fn(),
  mockDeliveryFindById:         vi.fn(),
  mockDeliveryFindOne:          vi.fn(),
  mockDeliveryUpdateOne:        vi.fn(),
  mockDeliveryCountDocuments:   vi.fn(),
  mockOuFind:                   vi.fn(),
  mockDnsLookup:                vi.fn(),
}))

vi.mock('dns', () => ({
  default: { promises: { lookup: mockDnsLookup } },
  promises: { lookup: mockDnsLookup },
}))

vi.mock('../../models/WebhookEndpoint.js', () => ({
  WEBHOOK_EVENT_TYPES: ['login.success', 'login.failed', 'mfa.enabled', 'mfa.disabled', 'secret.revealed', 'user.role_changed'],
  WebhookEndpoint: {
    create:           mockEndpointCreate,
    find:             mockEndpointFind,
    findById:         mockEndpointFindById,
    findOneAndUpdate: mockEndpointFindOneAndUpdate,
    deleteOne:        mockEndpointDeleteOne,
    updateOne:        mockEndpointUpdateOne,
  },
}))
vi.mock('../../models/WebhookDelivery.js', () => ({
  WebhookDelivery: {
    create:         mockDeliveryCreate,
    find:           mockDeliveryFind,
    findById:       mockDeliveryFindById,
    findOne:        mockDeliveryFindOne,
    updateOne:      mockDeliveryUpdateOne,
    countDocuments: mockDeliveryCountDocuments,
  },
}))
vi.mock('../../models/OrganizationUser.js', () => ({
  OrganizationUser: { find: mockOuFind },
}))

import crypto from 'crypto'
import mongoose from 'mongoose'
import { createEndpoint, listEndpoints, updateEndpoint, deleteEndpoint, regenerateSecret, listDeliveries } from '../webhooks.service.js'
import { encrypt as realEncrypt } from '../../lib/crypto.js'
import { dispatchEvent, attemptDelivery, retryFailedDeliveries, retryDeliveryManually } from '../webhooks.service.js'
import { NotFoundError } from '../../lib/errors.js'

const orgId    = new mongoose.Types.ObjectId()
const actorId  = new mongoose.Types.ObjectId()
const endpointId = new mongoose.Types.ObjectId()

beforeEach(() => {
  vi.clearAllMocks()
  mockDnsLookup.mockResolvedValue([{ address: '93.184.216.34' }])
})

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

    const result = await listDeliveries(orgId, String(endpointId), { page: 1, limit: 20 })

    expect(result.total).toBe(1)
    expect(result.deliveries).toHaveLength(1)
    expect(result.deliveries[0]!.status).toBe('success')
  })

  it('returns an empty page for an invalid webhookId without querying the database', async () => {
    const result = await listDeliveries(orgId, 'not-an-id', { page: 1, limit: 20 })
    expect(result).toEqual({ deliveries: [], total: 0, pages: 0 })
    expect(mockDeliveryFind).not.toHaveBeenCalled()
  })
})

const userId = new mongoose.Types.ObjectId()

describe('dispatchEvent', () => {
  it('creates a delivery for each active endpoint matching the event in the user\'s active orgs', async () => {
    mockOuFind.mockReturnValue({ lean: vi.fn().mockResolvedValue([{ orgId, userId, status: 'active' }]) })
    mockEndpointFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        { _id: endpointId, orgId, url: 'https://example.com/hook', events: ['login.success'], active: true },
      ]),
    })
    mockDeliveryCreate.mockResolvedValue({ _id: new mongoose.Types.ObjectId() })
    // attemptDelivery is fire-and-forget inside dispatchEvent; give it safe mocks so it resolves quietly
    mockDeliveryFindById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })

    await dispatchEvent('login.success', userId, { email: 'a@b.com' })

    expect(mockDeliveryCreate).toHaveBeenCalledWith(
      expect.objectContaining({ webhookId: endpointId, orgId, event: 'login.success', status: 'pending', attempts: 0 }),
    )
  })

  it('creates no deliveries when the user has no active org memberships', async () => {
    mockOuFind.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) })

    await dispatchEvent('login.success', userId, {})

    expect(mockDeliveryCreate).not.toHaveBeenCalled()
  })
})

describe('attemptDelivery', () => {
  const deliveryId = String(new mongoose.Types.ObjectId())

  it('marks delivery failed without a network call when the endpoint is inactive', async () => {
    mockDeliveryFindById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: deliveryId, status: 'pending', attempts: 0, webhookId: endpointId, payload: {} }),
    })
    mockEndpointFindById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: endpointId, active: false }) })
    const fetchSpy = vi.spyOn(global, 'fetch')

    await attemptDelivery(deliveryId)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(mockDeliveryUpdateOne).toHaveBeenCalledWith({ _id: deliveryId }, { $set: { status: 'failed' } })
  })

  it('signs the payload with HMAC-SHA256 of the decrypted secret and marks success on 2xx', async () => {
    const rawSecret = 'test-secret-value'
    const encryptedPayload = realEncrypt(rawSecret)
    const payload = { event: 'login.success', orgId: String(orgId), timestamp: '2026-01-01T00:00:00.000Z', data: {} }

    mockDeliveryFindById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: deliveryId, status: 'pending', attempts: 0, webhookId: endpointId, payload }),
    })
    mockEndpointFindById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: endpointId, active: true, url: 'https://example.com/hook',
        encryptedValue: encryptedPayload.encryptedValue, iv: encryptedPayload.iv, authTag: encryptedPayload.authTag,
      }),
    })

    const mockResponse = { ok: true, status: 200, text: vi.fn().mockResolvedValue('ok') }
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any)

    await attemptDelivery(deliveryId)

    const expectedSignature = crypto.createHmac('sha256', rawSecret).update(JSON.stringify(payload)).digest('hex')
    const fetchCall = (global.fetch as any).mock.calls[0]
    expect(fetchCall[1].headers['X-Webhook-Signature']).toBe(`sha256=${expectedSignature}`)
    expect(mockDeliveryUpdateOne).toHaveBeenCalledWith(
      { _id: deliveryId },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'success', attempts: 1, responseStatus: 200 }) }),
    )
  })

  it('schedules a retry on non-2xx response when attempts remain', async () => {
    mockDeliveryFindById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: deliveryId, status: 'pending', attempts: 0, webhookId: endpointId, payload: {} }),
    })
    const encryptedPayload = realEncrypt('secret')
    mockEndpointFindById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: endpointId, active: true, url: 'https://example.com/hook',
        encryptedValue: encryptedPayload.encryptedValue, iv: encryptedPayload.iv, authTag: encryptedPayload.authTag,
      }),
    })
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 500, text: vi.fn().mockResolvedValue('error') } as any)
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout')

    await attemptDelivery(deliveryId)

    expect(mockDeliveryUpdateOne).toHaveBeenCalledWith(
      { _id: deliveryId },
      expect.objectContaining({ $set: expect.objectContaining({ attempts: 1, nextRetryAt: expect.any(Date) }) }),
    )
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30_000)
  })

  it('marks permanently failed after the 3rd attempt with no further retry scheduled', async () => {
    mockDeliveryFindById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: deliveryId, status: 'pending', attempts: 2, webhookId: endpointId, payload: {} }),
    })
    const encryptedPayload = realEncrypt('secret')
    mockEndpointFindById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: endpointId, active: true, url: 'https://example.com/hook',
        encryptedValue: encryptedPayload.encryptedValue, iv: encryptedPayload.iv, authTag: encryptedPayload.authTag,
      }),
    })
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 500, text: vi.fn().mockResolvedValue('error') } as any)
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout')

    await attemptDelivery(deliveryId)

    expect(mockDeliveryUpdateOne).toHaveBeenCalledWith(
      { _id: deliveryId },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'failed', attempts: 3 }) }),
    )
    expect(setTimeoutSpy).not.toHaveBeenCalled()
  })
})

describe('retryFailedDeliveries', () => {
  it('re-attempts every pending delivery whose retry time has passed', async () => {
    const id1 = new mongoose.Types.ObjectId()
    mockDeliveryFind.mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: id1 }]) })
    mockDeliveryFindById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })

    await retryFailedDeliveries()

    expect(mockDeliveryFind).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
    )
  })
})

describe('retryDeliveryManually', () => {
  it('throws NotFoundError for an invalid delivery id', async () => {
    await expect(retryDeliveryManually(orgId, 'not-an-id')).rejects.toThrow(NotFoundError)
  })

  it('throws NotFoundError when the delivery does not exist in this org', async () => {
    mockDeliveryFindOne.mockResolvedValue(null)
    await expect(retryDeliveryManually(orgId, String(new mongoose.Types.ObjectId()))).rejects.toThrow(NotFoundError)
  })

  it('resets attempts and status before re-attempting, scoped to the org', async () => {
    const deliveryId = String(new mongoose.Types.ObjectId())
    mockDeliveryFindOne.mockResolvedValue({ _id: deliveryId, orgId })
    mockDeliveryFindById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })

    await retryDeliveryManually(orgId, deliveryId)

    expect(mockDeliveryFindOne).toHaveBeenCalledWith({ _id: deliveryId, orgId })
    expect(mockDeliveryUpdateOne).toHaveBeenCalledWith(
      { _id: deliveryId },
      { $set: { attempts: 0, status: 'pending', nextRetryAt: null } },
    )
  })
})

describe('SSRF protection on webhook URLs', () => {
  it('createEndpoint rejects a URL resolving to a private IP', async () => {
    mockDnsLookup.mockResolvedValue([{ address: '10.0.0.5' }])
    await expect(createEndpoint(orgId, { url: 'https://internal.example.com/hook', events: ['login.success'] }, actorId))
      .rejects.toThrow(/private or internal/)
  })

  it('createEndpoint rejects localhost', async () => {
    await expect(createEndpoint(orgId, { url: 'http://localhost:3000/hook', events: ['login.success'] }, actorId))
      .rejects.toThrow(/localhost/)
  })

  it('createEndpoint allows a URL resolving to a public IP', async () => {
    mockDnsLookup.mockResolvedValue([{ address: '93.184.216.34' }])
    mockEndpointCreate.mockResolvedValue({ _id: endpointId, url: 'https://example.com/hook', events: ['login.success'], active: true })
    const result = await createEndpoint(orgId, { url: 'https://example.com/hook', events: ['login.success'] }, actorId)
    expect(result.url).toBe('https://example.com/hook')
  })

  it('updateEndpoint rejects changing the url to a private-IP-resolving host', async () => {
    mockDnsLookup.mockResolvedValue([{ address: '172.16.0.1' }])
    await expect(updateEndpoint(orgId, String(endpointId), { url: 'https://evil.example.com/hook' }))
      .rejects.toThrow(/private or internal/)
  })
})
