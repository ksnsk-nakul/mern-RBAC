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

const {
  mockTicketCreate, mockTicketFind, mockTicketFindById, mockTicketFindOne,
  mockTicketFindOneAndUpdate, mockTicketUpdateOne, mockTicketCountDocuments,
  mockMsgCreate, mockMsgFind,
  mockUploadToGridFS, mockStreamFromGridFS,
} = vi.hoisted(() => ({
  mockTicketCreate:           vi.fn(),
  mockTicketFind:             vi.fn(),
  mockTicketFindById:         vi.fn(),
  mockTicketFindOne:          vi.fn(),
  mockTicketFindOneAndUpdate: vi.fn(),
  mockTicketUpdateOne:        vi.fn(),
  mockTicketCountDocuments:   vi.fn(),
  mockMsgCreate:              vi.fn(),
  mockMsgFind:                vi.fn(),
  mockUploadToGridFS:         vi.fn(),
  mockStreamFromGridFS:       vi.fn(),
}))

vi.mock('../../models/SupportTicket.js', () => ({
  SupportTicket: {
    create:            mockTicketCreate,
    find:              mockTicketFind,
    findById:          mockTicketFindById,
    findOne:           mockTicketFindOne,
    findOneAndUpdate:  mockTicketFindOneAndUpdate,
    updateOne:         mockTicketUpdateOne,
    countDocuments:    mockTicketCountDocuments,
  },
}))

vi.mock('../../models/TicketMessage.js', () => ({
  TicketMessage: {
    create: mockMsgCreate,
    find:   mockMsgFind,
  },
}))

vi.mock('../../lib/gridfs.js', () => ({
  uploadToGridFS:   mockUploadToGridFS,
  streamFromGridFS: mockStreamFromGridFS,
}))

import mongoose from 'mongoose'
import {
  createTicket, listAdminTickets, listMyTickets,
  getAdminTicket, getUserTicket, updateTicketMeta, addMessage,
} from '../tickets.service.js'
import { NotFoundError, ForbiddenError } from '../../lib/errors.js'

const ticketId = new mongoose.Types.ObjectId()
const userId   = new mongoose.Types.ObjectId()
const adminId  = new mongoose.Types.ObjectId()
const fileId   = new mongoose.Types.ObjectId()

const sampleTicket = {
  _id: ticketId, subject: 'Help me', status: 'open', priority: 'medium',
  requestedBy: userId, createdAt: new Date(), updatedAt: new Date(),
}

const sampleMessage = {
  _id: new mongoose.Types.ObjectId(), ticketId, userId,
  body: 'Hello world', isInternal: false, attachments: [], createdAt: new Date(),
}

beforeEach(() => { vi.clearAllMocks() })

describe('createTicket', () => {
  it('creates a ticket and the first message', async () => {
    mockTicketCreate.mockResolvedValue(sampleTicket)
    mockMsgCreate.mockResolvedValue(sampleMessage)

    const result = await createTicket({ subject: 'Help me', body: 'Hello world' }, userId)

    expect(mockTicketCreate).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Help me', requestedBy: userId, status: 'open', priority: 'medium' }),
    )
    expect(mockMsgCreate).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: sampleTicket._id, userId, body: 'Hello world', isInternal: false }),
    )
    expect(result.id).toBe(String(ticketId))
    expect(result.subject).toBe('Help me')
  })

  it('uploads files to GridFS and stores attachment metadata', async () => {
    mockTicketCreate.mockResolvedValue(sampleTicket)
    mockUploadToGridFS.mockResolvedValue(fileId)
    mockMsgCreate.mockResolvedValue({ ...sampleMessage, attachments: [{ filename: 'a.png', contentType: 'image/png', size: 100, gridfsId: fileId }] })

    const fakeFile = { originalname: 'a.png', mimetype: 'image/png', size: 100, buffer: Buffer.from('x') } as Express.Multer.File
    await createTicket({ subject: 'Help me', body: 'See screenshot' }, userId, [fakeFile])

    expect(mockUploadToGridFS).toHaveBeenCalledWith(fakeFile.buffer, 'a.png', 'image/png')
    expect(mockMsgCreate).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: [{ filename: 'a.png', contentType: 'image/png', size: 100, gridfsId: fileId }] }),
    )
  })
})

describe('listAdminTickets', () => {
  it('returns paginated tickets without status filter when status is omitted', async () => {
    mockTicketFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([sampleTicket]) }),
        }),
      }),
    })
    mockTicketCountDocuments.mockResolvedValue(1)

    const result = await listAdminTickets({})

    expect(mockTicketFind).toHaveBeenCalledWith({})
    expect(result.total).toBe(1)
    expect(result.pages).toBe(1)
    expect(result.tickets[0]!.id).toBe(String(ticketId))
  })

  it('filters by status when provided', async () => {
    mockTicketFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
        }),
      }),
    })
    mockTicketCountDocuments.mockResolvedValue(0)

    await listAdminTickets({ status: 'open' })
    expect(mockTicketFind).toHaveBeenCalledWith(expect.objectContaining({ status: 'open' }))
  })
})

describe('listMyTickets', () => {
  it('scopes query to requestedBy', async () => {
    mockTicketFind.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([sampleTicket]) }),
        }),
      }),
    })
    mockTicketCountDocuments.mockResolvedValue(1)

    const result = await listMyTickets(userId, {})
    expect(mockTicketFind).toHaveBeenCalledWith(expect.objectContaining({ requestedBy: userId }))
    expect(result.tickets[0]!.id).toBe(String(ticketId))
  })
})

describe('getAdminTicket', () => {
  it('returns null when ticket not found', async () => {
    mockTicketFindById.mockResolvedValue(null)
    const result = await getAdminTicket(String(ticketId))
    expect(result).toBeNull()
  })

  it('returns ticket with ALL messages including internal ones', async () => {
    mockTicketFindById.mockReturnValue({ lean: vi.fn().mockResolvedValue(sampleTicket) })
    const internalMsg = { ...sampleMessage, isInternal: true }
    mockMsgFind.mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([sampleMessage, internalMsg]) }) })

    const result = await getAdminTicket(String(ticketId))
    expect(result!.messages).toHaveLength(2)
  })
})

describe('getUserTicket', () => {
  it('throws ForbiddenError when ticket belongs to a different user', async () => {
    const otherUserId = new mongoose.Types.ObjectId()
    mockTicketFindById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ ...sampleTicket, requestedBy: otherUserId }) })

    await expect(getUserTicket(String(ticketId), userId)).rejects.toThrow(ForbiddenError)
  })

  it('filters out internal messages for the ticket owner', async () => {
    mockTicketFindById.mockReturnValue({ lean: vi.fn().mockResolvedValue(sampleTicket) })
    const internalMsg = { ...sampleMessage, isInternal: true }
    mockMsgFind.mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([sampleMessage, internalMsg]) }) })

    const result = await getUserTicket(String(ticketId), userId)
    expect(result!.messages).toHaveLength(1)
    expect(result!.messages[0]!.isInternal).toBe(false)
  })
})

describe('updateTicketMeta', () => {
  it('throws NotFoundError when ticket does not exist', async () => {
    mockTicketFindOneAndUpdate.mockResolvedValue(null)
    await expect(updateTicketMeta(String(ticketId), { status: 'resolved' })).rejects.toThrow(NotFoundError)
  })

  it('returns updated ticket item', async () => {
    mockTicketFindOneAndUpdate.mockResolvedValue({ ...sampleTicket, status: 'resolved' })
    const result = await updateTicketMeta(String(ticketId), { status: 'resolved' })
    expect(result.status).toBe('resolved')
  })
})

describe('addMessage', () => {
  it('throws NotFoundError when ticket does not exist', async () => {
    mockTicketFindById.mockResolvedValue(null)
    await expect(addMessage(String(ticketId), userId, { body: 'hi', isInternal: false })).rejects.toThrow(NotFoundError)
  })

  it('creates the message and uploads attachments', async () => {
    mockTicketFindById.mockResolvedValue(sampleTicket)
    mockUploadToGridFS.mockResolvedValue(fileId)
    mockMsgCreate.mockResolvedValue(sampleMessage)

    const fakeFile = { originalname: 'log.txt', mimetype: 'text/plain', size: 50, buffer: Buffer.from('log') } as Express.Multer.File
    await addMessage(String(ticketId), adminId, { body: 'See log', isInternal: true }, [fakeFile])

    expect(mockUploadToGridFS).toHaveBeenCalledWith(fakeFile.buffer, 'log.txt', 'text/plain')
    expect(mockMsgCreate).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: sampleTicket._id, userId: adminId, body: 'See log', isInternal: true }),
    )
  })
})
