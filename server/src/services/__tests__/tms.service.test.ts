import { describe, it, expect, vi, beforeEach } from 'vitest'
import mongoose from 'mongoose'

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
  mockProjectCreate, mockProjectFind, mockProjectFindOne, mockProjectFindOneAndUpdate,
  mockProjectDeleteOne, mockProjectCountDocuments,
  mockTaskCreate, mockTaskFind, mockTaskFindOne, mockTaskFindOneAndUpdate,
  mockTaskDeleteOne, mockTaskCountDocuments,
  mockActivityCreate,
  mockUserFindById,
} = vi.hoisted(() => ({
  mockProjectCreate:           vi.fn(),
  mockProjectFind:             vi.fn(),
  mockProjectFindOne:          vi.fn(),
  mockProjectFindOneAndUpdate: vi.fn(),
  mockProjectDeleteOne:        vi.fn(),
  mockProjectCountDocuments:   vi.fn(),
  mockTaskCreate:              vi.fn(),
  mockTaskFind:                vi.fn(),
  mockTaskFindOne:             vi.fn(),
  mockTaskFindOneAndUpdate:    vi.fn(),
  mockTaskDeleteOne:           vi.fn(),
  mockTaskCountDocuments:      vi.fn(),
  mockActivityCreate:          vi.fn(),
  mockUserFindById:            vi.fn(),
}))

vi.mock('../../models/Project.js', () => ({
  Project: {
    create:           mockProjectCreate,
    find:             mockProjectFind,
    findOne:          mockProjectFindOne,
    findOneAndUpdate: mockProjectFindOneAndUpdate,
    deleteOne:        mockProjectDeleteOne,
    countDocuments:   mockProjectCountDocuments,
  },
}))

vi.mock('../../models/Task.js', () => ({
  Task: {
    create:           mockTaskCreate,
    find:             mockTaskFind,
    findOne:          mockTaskFindOne,
    findOneAndUpdate: mockTaskFindOneAndUpdate,
    deleteOne:        mockTaskDeleteOne,
    countDocuments:   mockTaskCountDocuments,
  },
}))

vi.mock('../../models/TaskActivity.js', () => ({
  TaskActivity: { create: mockActivityCreate },
}))

vi.mock('../../models/User.js', () => ({
  User: { findById: mockUserFindById },
}))

import * as TmsService from '../tms.service.js'
import { ForbiddenError, NotFoundError } from '../../lib/errors.js'

const uid  = new mongoose.Types.ObjectId()
const pid  = new mongoose.Types.ObjectId()
const tid  = new mongoose.Types.ObjectId()
const now  = new Date()

function makeProject(overrides = {}) {
  return {
    _id: pid, userId: uid,
    title: 'My Project', description: 'desc',
    status: 'active', progress: 0, archivedAt: null,
    createdAt: now, updatedAt: now,
    ...overrides,
  }
}

function makeTask(overrides = {}) {
  return {
    _id: tid, userId: uid, projectId: pid,
    title: 'My Task', status: 'todo', priority: 'medium',
    dueDate: null, notes: '', completedAt: null,
    createdAt: now, updatedAt: now,
    ...overrides,
  }
}

beforeEach(() => vi.clearAllMocks())

// ── Projects ──────────────────────────────────────────────────────────────────

describe('createProject', () => {
  it('creates and returns a ProjectItem', async () => {
    mockProjectCreate.mockResolvedValue(makeProject())
    const result = await TmsService.createProject(uid, { title: 'My Project', description: 'desc' })
    expect(mockProjectCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: uid, title: 'My Project', description: 'desc' })
    )
    expect(result.title).toBe('My Project')
    expect(result.id).toBe(String(pid))
  })
})

describe('listProjects', () => {
  it('excludes archived by default', async () => {
    mockProjectFind.mockReturnValue({ lean: () => Promise.resolve([makeProject()]) })
    await TmsService.listProjects(uid, false)
    expect(mockProjectFind).toHaveBeenCalledWith(
      expect.objectContaining({ userId: uid, archivedAt: null })
    )
  })

  it('includes archived when requested', async () => {
    mockProjectFind.mockReturnValue({ lean: () => Promise.resolve([]) })
    await TmsService.listProjects(uid, true)
    const call = mockProjectFind.mock.calls[0][0]
    expect(call).not.toHaveProperty('archivedAt')
  })
})

describe('getProject', () => {
  it('returns null if not found', async () => {
    mockProjectFindOne.mockReturnValue({ lean: () => Promise.resolve(null) })
    const result = await TmsService.getProject(uid, String(pid))
    expect(result).toBeNull()
  })

  it('throws ForbiddenError if userId does not match', async () => {
    const otherId = new mongoose.Types.ObjectId()
    mockProjectFindOne.mockReturnValue({ lean: () => Promise.resolve(makeProject({ userId: otherId })) })
    await expect(TmsService.getProject(uid, String(pid))).rejects.toThrow(ForbiddenError)
  })
})

describe('archiveProject', () => {
  it('sets archivedAt and returns updated project', async () => {
    mockProjectFindOneAndUpdate.mockReturnValue({
      lean: () => Promise.resolve(makeProject({ archivedAt: now })),
    })
    const result = await TmsService.archiveProject(uid, String(pid))
    expect(mockProjectFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: expect.any(mongoose.Types.ObjectId), userId: uid },
      { $set: { archivedAt: expect.any(Date) } },
      { new: true },
    )
    expect(result?.archivedAt).toBeTruthy()
  })

  it('returns null if project not found', async () => {
    mockProjectFindOneAndUpdate.mockReturnValue({ lean: () => Promise.resolve(null) })
    const result = await TmsService.archiveProject(uid, String(pid))
    expect(result).toBeNull()
  })
})

// ── Tasks ─────────────────────────────────────────────────────────────────────

describe('createTask', () => {
  it('creates a task and appends created activity', async () => {
    mockTaskCreate.mockResolvedValue(makeTask())
    mockActivityCreate.mockResolvedValue({})
    const result = await TmsService.createTask(uid, { title: 'My Task', projectId: String(pid) })
    expect(mockTaskCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: uid, title: 'My Task' })
    )
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'created' })
    )
    expect(result.title).toBe('My Task')
  })
})

describe('completeTask', () => {
  it('sets status to done and logs completed activity', async () => {
    mockTaskFindOneAndUpdate.mockReturnValue({
      lean: () => Promise.resolve(makeTask({ status: 'done', completedAt: now })),
    })
    mockActivityCreate.mockResolvedValue({})
    const result = await TmsService.completeTask(uid, String(tid))
    expect(mockTaskFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: expect.any(mongoose.Types.ObjectId), userId: uid },
      { $set: { status: 'done', completedAt: expect.any(Date) } },
      { new: true },
    )
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'completed' })
    )
    expect(result?.status).toBe('done')
  })

  it('returns null if task not found', async () => {
    mockTaskFindOneAndUpdate.mockReturnValue({ lean: () => Promise.resolve(null) })
    const result = await TmsService.completeTask(uid, String(tid))
    expect(result).toBeNull()
  })
})

describe('reopenTask', () => {
  it('sets status to todo and clears completedAt', async () => {
    mockTaskFindOneAndUpdate.mockReturnValue({
      lean: () => Promise.resolve(makeTask({ status: 'todo', completedAt: null })),
    })
    mockActivityCreate.mockResolvedValue({})
    await TmsService.reopenTask(uid, String(tid))
    expect(mockTaskFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: expect.any(mongoose.Types.ObjectId), userId: uid },
      { $set: { status: 'todo', completedAt: null } },
      { new: true },
    )
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'reopened' })
    )
  })
})

// ── Planner ───────────────────────────────────────────────────────────────────

describe('getPlanner', () => {
  it('returns today, overdue, and upcoming buckets', async () => {
    const todayTask    = makeTask({ title: 'Today task', dueDate: new Date() })
    const overdueTask  = makeTask({ title: 'Overdue task', dueDate: new Date(Date.now() - 86400_000 * 2), status: 'todo' })
    const upcomingTask = makeTask({ title: 'Upcoming task', dueDate: new Date(Date.now() + 86400_000 * 3) })

    mockTaskFind
      .mockReturnValueOnce({ lean: () => Promise.resolve([todayTask]) })
      .mockReturnValueOnce({ lean: () => Promise.resolve([overdueTask]) })
      .mockReturnValueOnce({ lean: () => Promise.resolve([upcomingTask]) })

    const result = await TmsService.getPlanner(uid)
    expect(result.today).toHaveLength(1)
    expect(result.overdue).toHaveLength(1)
    expect(result.upcoming).toHaveLength(1)
  })
})

// ── TextToProject ─────────────────────────────────────────────────────────────

describe('textToProject', () => {
  it('throws ForbiddenError if user is not founder', async () => {
    mockUserFindById.mockReturnValue({ lean: () => Promise.resolve({ isFounder: false }) })
    await expect(TmsService.textToProject(uid, 'My Project\nsome description')).rejects.toThrow(ForbiddenError)
  })

  it('uses first line as title, rest as description', async () => {
    mockUserFindById.mockReturnValue({ lean: () => Promise.resolve({ isFounder: true }) })
    mockProjectCreate.mockResolvedValue(makeProject({ title: 'My Project', description: 'some description' }))
    const result = await TmsService.textToProject(uid, 'My Project\nsome description')
    expect(mockProjectCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'My Project', description: 'some description' })
    )
    expect(result.title).toBe('My Project')
  })
})
