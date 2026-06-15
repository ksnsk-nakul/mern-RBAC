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

const { mockCreate, mockFind, mockCountDocuments } = vi.hoisted(() => ({
  mockCreate:         vi.fn(),
  mockFind:           vi.fn(),
  mockCountDocuments: vi.fn(),
}))

vi.mock('../../models/ActivityLog.js', () => ({
  ActivityLog: {
    create:         mockCreate,
    findOne:        vi.fn().mockImplementation(() => ({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
    })),
    find:           mockFind,
    countDocuments: mockCountDocuments,
  },
}))

import crypto from 'crypto'
import { ActivityLog } from '../../models/ActivityLog.js'
import { appendActivity, listActivity, verifyChain } from '../activityLog.service.js'

function hashContent(content: object): string {
  return crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(ActivityLog.findOne).mockImplementation(
    () => ({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }) }) as any,
  )
  mockCreate.mockResolvedValue({})
  mockCountDocuments.mockResolvedValue(0)
  mockFind.mockReturnValue({
    sort: vi.fn().mockReturnValue({
      skip: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
      }),
    }),
  })
})

describe('appendActivity', () => {
  it('uses genesis as prevHash when no previous record exists', async () => {
    await appendActivity({ action: 'user.created', actorEmail: 'admin@test.com' })

    expect(mockCreate).toHaveBeenCalledOnce()
    const created = mockCreate.mock.calls[0][0] as any
    expect(created.prevHash).toBe('genesis')
  })

  it('stores the correct SHA-256 hash of content+prevHash', async () => {
    await appendActivity({ action: 'user.created', actorEmail: 'admin@test.com' })

    const created = mockCreate.mock.calls[0][0] as any
    const expectedContent = { action: 'user.created', actorEmail: 'admin@test.com', prevHash: 'genesis' }
    const expectedHash = hashContent(expectedContent)
    expect(created.hash).toBe(expectedHash)
  })

  it('uses previous record hash as prevHash for subsequent entries', async () => {
    const prevRecord = { hash: 'abc123prevhash', createdAt: new Date() }
    vi.mocked(ActivityLog.findOne).mockImplementation(
      () => ({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(prevRecord) }) }) as any,
    )

    await appendActivity({ action: 'role.updated', targetName: 'admin' })

    const created = mockCreate.mock.calls[0][0] as any
    expect(created.prevHash).toBe('abc123prevhash')
  })

  it('does not include undefined fields in the hash content', async () => {
    await appendActivity({ action: 'secret.revealed' })

    const created = mockCreate.mock.calls[0][0] as any
    const content = { action: 'secret.revealed', prevHash: 'genesis' }
    expect(created.hash).toBe(hashContent(content))
  })
})

describe('listActivity', () => {
  it('returns logs and pagination info', async () => {
    const fakeLogs = [{ _id: 'a', action: 'user.created', hash: 'h1', prevHash: 'genesis', createdAt: new Date() }]
    mockFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(fakeLogs) }),
        }),
      }),
    })
    mockCountDocuments.mockResolvedValue(1)

    const result = await listActivity({ page: 1, limit: 20 })

    expect(result.logs).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.pages).toBe(1)
  })
})

describe('verifyChain', () => {
  it('returns valid:true for an empty chain', async () => {
    mockFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
    })

    const result = await verifyChain()
    expect(result.valid).toBe(true)
  })

  it('returns valid:true when all hashes match', async () => {
    const entry1Content = { action: 'user.created', prevHash: 'genesis' }
    const entry1Hash    = hashContent(entry1Content)
    const entry2Content = { action: 'role.updated', prevHash: entry1Hash }
    const entry2Hash    = hashContent(entry2Content)

    const records = [
      { action: 'user.created', prevHash: 'genesis', hash: entry1Hash },
      { action: 'role.updated', prevHash: entry1Hash, hash: entry2Hash },
    ]
    mockFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(records) }),
    })

    const result = await verifyChain()
    expect(result.valid).toBe(true)
    expect(result.brokenAt).toBeUndefined()
  })

  it('returns valid:false and brokenAt index when a hash is tampered', async () => {
    const correctHash = hashContent({ action: 'user.created', prevHash: 'genesis' })
    const records = [
      { action: 'user.created', prevHash: 'genesis', hash: correctHash },
      { action: 'role.updated', prevHash: correctHash, hash: 'TAMPERED' },
    ]
    mockFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(records) }),
    })

    const result = await verifyChain()
    expect(result.valid).toBe(false)
    expect(result.brokenAt).toBeDefined()
  })
})
