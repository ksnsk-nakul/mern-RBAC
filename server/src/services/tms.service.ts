import mongoose from 'mongoose'
import { Project, type ProjectStatus } from '../models/Project.js'
import { Task, type TaskStatus, type TaskPriority } from '../models/Task.js'
import { TaskActivity } from '../models/TaskActivity.js'
import { User } from '../models/User.js'
import { ForbiddenError } from '../lib/errors.js'

// ── Item shapes ───────────────────────────────────────────────────────────────

export interface ProjectItem {
  id:          string
  userId:      string
  title:       string
  description: string
  status:      ProjectStatus
  progress:    number
  archivedAt:  string | null
  createdAt:   string
  updatedAt:   string
}

export interface TaskItem {
  id:          string
  userId:      string
  projectId:   string | null
  title:       string
  status:      TaskStatus
  priority:    TaskPriority
  dueDate:     string | null
  notes:       string
  completedAt: string | null
  createdAt:   string
  updatedAt:   string
}

export interface ActivityItem {
  id:          string
  action:      string
  description: string
  meta:        Record<string, unknown>
  createdAt:   string
}

export interface TaskWithActivities extends TaskItem {
  activities: ActivityItem[]
}

export interface PlannerResult {
  today:    TaskItem[]
  overdue:  TaskItem[]
  upcoming: TaskItem[]
}

// ── Internal lean types ───────────────────────────────────────────────────────

interface ProjectLean {
  _id:         mongoose.Types.ObjectId
  userId:      mongoose.Types.ObjectId
  title:       string
  description: string
  status:      ProjectStatus
  progress:    number
  archivedAt:  Date | null
  createdAt:   Date
  updatedAt:   Date
}

interface TaskLean {
  _id:         mongoose.Types.ObjectId
  userId:      mongoose.Types.ObjectId
  projectId:   mongoose.Types.ObjectId | null
  title:       string
  status:      TaskStatus
  priority:    TaskPriority
  dueDate:     Date | null
  notes:       string
  completedAt: Date | null
  createdAt:   Date
  updatedAt:   Date
}

interface ActivityLean {
  _id:         mongoose.Types.ObjectId
  action:      string
  description: string
  meta:        Record<string, unknown>
  createdAt:   Date
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function toProjectItem(p: ProjectLean): ProjectItem {
  return {
    id:          String(p._id),
    userId:      String(p.userId),
    title:       p.title,
    description: p.description,
    status:      p.status,
    progress:    p.progress,
    archivedAt:  p.archivedAt?.toISOString() ?? null,
    createdAt:   p.createdAt?.toISOString() ?? '',
    updatedAt:   p.updatedAt?.toISOString() ?? '',
  }
}

function toTaskItem(t: TaskLean): TaskItem {
  return {
    id:          String(t._id),
    userId:      String(t.userId),
    projectId:   t.projectId ? String(t.projectId) : null,
    title:       t.title,
    status:      t.status,
    priority:    t.priority,
    dueDate:     t.dueDate?.toISOString() ?? null,
    notes:       t.notes,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt:   t.createdAt?.toISOString() ?? '',
    updatedAt:   t.updatedAt?.toISOString() ?? '',
  }
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function createProject(
  userId: mongoose.Types.ObjectId,
  input: { title: string; description?: string },
): Promise<ProjectItem> {
  const p = await Project.create({ userId, title: input.title, description: input.description ?? '' })
  return toProjectItem(p as unknown as ProjectLean)
}

export async function listProjects(
  userId: mongoose.Types.ObjectId,
  includeArchived: boolean,
): Promise<ProjectItem[]> {
  const filter: Record<string, unknown> = { userId }
  if (!includeArchived) filter.archivedAt = null
  const projects = await Project.find(filter).lean()
  return (projects as unknown as ProjectLean[]).map(toProjectItem)
}

export async function getProject(
  userId: mongoose.Types.ObjectId,
  id: string,
): Promise<ProjectItem | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null
  const p = await Project.findOne({ _id: new mongoose.Types.ObjectId(id) }).lean()
  if (!p) return null
  const pl = p as unknown as ProjectLean
  if (String(pl.userId) !== String(userId)) throw new ForbiddenError('Access denied')
  return toProjectItem(pl)
}

export async function updateProject(
  userId: mongoose.Types.ObjectId,
  id: string,
  input: { title?: string; description?: string; status?: ProjectStatus; progress?: number },
): Promise<ProjectItem | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null
  const p = await Project.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(id), userId },
    { $set: input },
    { new: true },
  ).lean()
  return p ? toProjectItem(p as unknown as ProjectLean) : null
}

export async function deleteProject(
  userId: mongoose.Types.ObjectId,
  id: string,
): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(id)) return false
  const result = await Project.deleteOne({ _id: new mongoose.Types.ObjectId(id), userId })
  return result.deletedCount > 0
}

export async function archiveProject(
  userId: mongoose.Types.ObjectId,
  id: string,
): Promise<ProjectItem | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null
  const p = await Project.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(id), userId },
    { $set: { archivedAt: new Date() } },
    { new: true },
  ).lean()
  return p ? toProjectItem(p as unknown as ProjectLean) : null
}

export async function unarchiveProject(
  userId: mongoose.Types.ObjectId,
  id: string,
): Promise<ProjectItem | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null
  const p = await Project.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(id), userId },
    { $set: { archivedAt: null } },
    { new: true },
  ).lean()
  return p ? toProjectItem(p as unknown as ProjectLean) : null
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function createTask(
  userId: mongoose.Types.ObjectId,
  input: { title: string; projectId?: string | null; priority?: TaskPriority; dueDate?: string | null; notes?: string },
): Promise<TaskItem> {
  const projectId = input.projectId && mongoose.Types.ObjectId.isValid(input.projectId)
    ? new mongoose.Types.ObjectId(input.projectId)
    : null
  const t = await Task.create({
    userId,
    projectId,
    title:    input.title,
    priority: input.priority ?? 'medium',
    dueDate:  input.dueDate ? new Date(input.dueDate) : null,
    notes:    input.notes ?? '',
  })
  await TaskActivity.create({ taskId: t._id, userId, action: 'created', description: `Task "${input.title}" created`, meta: {} })
  return toTaskItem(t as unknown as TaskLean)
}

export async function listTasks(
  userId: mongoose.Types.ObjectId,
  filter: { projectId?: string; status?: TaskStatus; priority?: TaskPriority; page?: number; limit?: number },
): Promise<{ tasks: TaskItem[]; total: number; pages: number }> {
  const query: Record<string, unknown> = { userId }
  if (filter.projectId && mongoose.Types.ObjectId.isValid(filter.projectId))
    query.projectId = new mongoose.Types.ObjectId(filter.projectId)
  if (filter.status)   query.status   = filter.status
  if (filter.priority) query.priority = filter.priority

  const page  = filter.page  ?? 1
  const limit = filter.limit ?? 20
  const skip  = (page - 1) * limit

  const [tasks, total] = await Promise.all([
    Task.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Task.countDocuments(query),
  ])

  return {
    tasks: (tasks as unknown as TaskLean[]).map(toTaskItem),
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  }
}

export async function getTask(
  userId: mongoose.Types.ObjectId,
  id: string,
): Promise<TaskWithActivities | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null
  const oid = new mongoose.Types.ObjectId(id)
  const t = await Task.findOne({ _id: oid, userId }).lean()
  if (!t) return null
  const activities = await TaskActivity.find({ taskId: oid }).sort({ createdAt: 1 }).lean()
  return {
    ...toTaskItem(t as unknown as TaskLean),
    activities: (activities as unknown as ActivityLean[]).map((a) => ({
      id:          String(a._id),
      action:      a.action,
      description: a.description,
      meta:        a.meta,
      createdAt:   a.createdAt?.toISOString() ?? '',
    })),
  }
}

export async function updateTask(
  userId: mongoose.Types.ObjectId,
  id: string,
  input: { title?: string; status?: TaskStatus; priority?: TaskPriority; dueDate?: string | null; notes?: string; projectId?: string | null },
): Promise<TaskItem | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null
  const set: Record<string, unknown> = {}
  if (input.title    !== undefined) set.title    = input.title
  if (input.status   !== undefined) set.status   = input.status
  if (input.priority !== undefined) set.priority = input.priority
  if (input.notes    !== undefined) set.notes    = input.notes
  if (input.dueDate  !== undefined) set.dueDate  = input.dueDate ? new Date(input.dueDate) : null
  if (input.projectId !== undefined) {
    set.projectId = input.projectId && mongoose.Types.ObjectId.isValid(input.projectId)
      ? new mongoose.Types.ObjectId(input.projectId)
      : null
  }

  const t = await Task.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(id), userId },
    { $set: set },
    { new: true },
  ).lean()
  if (!t) return null
  await TaskActivity.create({ taskId: new mongoose.Types.ObjectId(id), userId, action: 'updated', description: 'Task updated', meta: set })
  return toTaskItem(t as unknown as TaskLean)
}

export async function deleteTask(
  userId: mongoose.Types.ObjectId,
  id: string,
): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(id)) return false
  const result = await Task.deleteOne({ _id: new mongoose.Types.ObjectId(id), userId })
  return result.deletedCount > 0
}

export async function completeTask(
  userId: mongoose.Types.ObjectId,
  id: string,
): Promise<TaskItem | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null
  const oid = new mongoose.Types.ObjectId(id)
  const t = await Task.findOneAndUpdate(
    { _id: oid, userId },
    { $set: { status: 'done', completedAt: new Date() } },
    { new: true },
  ).lean()
  if (!t) return null
  await TaskActivity.create({ taskId: oid, userId, action: 'completed', description: 'Task marked as done', meta: {} })
  return toTaskItem(t as unknown as TaskLean)
}

export async function reopenTask(
  userId: mongoose.Types.ObjectId,
  id: string,
): Promise<TaskItem | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null
  const oid = new mongoose.Types.ObjectId(id)
  const t = await Task.findOneAndUpdate(
    { _id: oid, userId },
    { $set: { status: 'todo', completedAt: null } },
    { new: true },
  ).lean()
  if (!t) return null
  await TaskActivity.create({ taskId: oid, userId, action: 'reopened', description: 'Task reopened', meta: {} })
  return toTaskItem(t as unknown as TaskLean)
}

// ── Planner ───────────────────────────────────────────────────────────────────

export async function getPlanner(userId: mongoose.Types.ObjectId): Promise<PlannerResult> {
  const now   = new Date()
  const start = new Date(now); start.setHours(0, 0, 0, 0)
  const end   = new Date(now); end.setHours(23, 59, 59, 999)
  const in7   = new Date(now); in7.setDate(in7.getDate() + 7)

  const [today, overdue, upcoming] = await Promise.all([
    Task.find({ userId, dueDate: { $gte: start, $lte: end }, status: { $ne: 'done' } }).lean(),
    Task.find({ userId, dueDate: { $lt: start }, status: { $ne: 'done' } }).lean(),
    Task.find({ userId, dueDate: { $gt: end, $lte: in7 }, status: { $ne: 'done' } }).lean(),
  ])

  return {
    today:    (today    as unknown as TaskLean[]).map(toTaskItem),
    overdue:  (overdue  as unknown as TaskLean[]).map(toTaskItem),
    upcoming: (upcoming as unknown as TaskLean[]).map(toTaskItem),
  }
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

export async function getDashboardStats(userId: mongoose.Types.ObjectId) {
  const now        = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999)
  const weekStart  = new Date(now); weekStart.setDate(weekStart.getDate() - 7); weekStart.setHours(0, 0, 0, 0)

  const [todayTasks, activeProjects, overdueTasks, completedThisWeek] = await Promise.all([
    Task.countDocuments({ userId, dueDate: { $gte: todayStart, $lte: todayEnd }, status: { $ne: 'done' } }),
    Project.countDocuments({ userId, archivedAt: null, status: { $ne: 'completed' } }),
    Task.countDocuments({ userId, dueDate: { $lt: todayStart }, status: { $ne: 'done' } }),
    Task.countDocuments({ userId, completedAt: { $gte: weekStart } }),
  ])

  return { todayTasks, activeProjects, overdueTasks, completedThisWeek }
}

// ── TextToProject ─────────────────────────────────────────────────────────────

export async function textToProject(
  userId: mongoose.Types.ObjectId,
  text: string,
): Promise<ProjectItem> {
  const user = await User.findById(userId).lean()
  if (!(user as { isFounder?: boolean } | null)?.isFounder) {
    throw new ForbiddenError('TextToProject is available to founders only')
  }
  const lines = text.trim().split('\n')
  const title = lines[0].trim() || 'Untitled'
  const description = lines.slice(1).join('\n').trim()
  const p = await Project.create({ userId, title, description })
  return toProjectItem(p as unknown as ProjectLean)
}
