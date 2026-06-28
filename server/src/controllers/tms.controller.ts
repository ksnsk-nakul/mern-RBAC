import type { Request, Response } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { asyncHandler } from '../lib/errors.js'
import * as TmsService from '../services/tms.service.js'
import * as ActivityLogService from '../services/activityLog.service.js'

interface AuthUser { userId: mongoose.Types.ObjectId }
function auth(req: Request): AuthUser { return req.user as unknown as AuthUser }

const createProjectSchema = z.object({
  title:       z.string().min(1).max(255),
  description: z.string().max(5000).optional().default(''),
})

const updateProjectSchema = z.object({
  title:       z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  status:      z.enum(['active', 'paused', 'completed']).optional(),
  progress:    z.number().min(0).max(100).optional(),
})

const createTaskSchema = z.object({
  title:     z.string().min(1).max(255),
  projectId: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(),
  priority:  z.enum(['low', 'medium', 'high']).optional(),
  dueDate:   z.string().datetime().nullable().optional(),
  notes:     z.string().max(10000).optional(),
})

const updateTaskSchema = z.object({
  title:     z.string().min(1).max(255).optional(),
  status:    z.enum(['todo', 'in_progress', 'done']).optional(),
  priority:  z.enum(['low', 'medium', 'high']).optional(),
  dueDate:   z.string().datetime().nullable().optional(),
  notes:     z.string().max(10000).optional(),
  projectId: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(),
})

const textToProjectSchema = z.object({
  text: z.string().min(1).max(10000),
})

export const listProjects = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = auth(req)
  const includeArchived = req.query.include_archived === 'true'
  const projects = await TmsService.listProjects(userId, includeArchived)
  res.json({ projects })
})

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const { title, description } = createProjectSchema.parse(req.body)
  const { userId } = auth(req)
  const project = await TmsService.createProject(userId, { title, description })
  ActivityLogService.appendActivity({ action: 'tms.project.created', actorId: userId, targetType: 'project', targetId: project.id, targetName: project.title }).catch(() => {})
  res.status(201).json({ project })
})

export const getProject = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = auth(req)
  const project = await TmsService.getProject(userId, req.params.id as string)
  if (!project) return res.status(404).json({ error: 'Project not found' })
  res.json({ project })
})

export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  const input = updateProjectSchema.parse(req.body)
  const { userId } = auth(req)
  const project = await TmsService.updateProject(userId, req.params.id as string, input)
  if (!project) return res.status(404).json({ error: 'Project not found' })
  res.json({ project })
})

export const deleteProject = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = auth(req)
  const deleted = await TmsService.deleteProject(userId, req.params.id as string)
  if (!deleted) return res.status(404).json({ error: 'Project not found' })
  ActivityLogService.appendActivity({ action: 'tms.project.deleted', actorId: userId, targetType: 'project', targetId: req.params.id as string }).catch(() => {})
  res.status(204).send()
})

export const archiveProject = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = auth(req)
  const project = await TmsService.archiveProject(userId, req.params.id as string)
  if (!project) return res.status(404).json({ error: 'Project not found' })
  res.json({ project })
})

export const unarchiveProject = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = auth(req)
  const project = await TmsService.unarchiveProject(userId, req.params.id as string)
  if (!project) return res.status(404).json({ error: 'Project not found' })
  res.json({ project })
})

export const getPlanner = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = auth(req)
  const planner = await TmsService.getPlanner(userId)
  res.json(planner)
})

export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = auth(req)
  const stats = await TmsService.getDashboardStats(userId)
  res.json(stats)
})

export const listTasks = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = auth(req)
  const page      = Number(req.query.page)     || 1
  const limit     = Math.min(Number(req.query.limit) || 20, 100)
  const projectId = req.query.project_id as string | undefined
  const status    = req.query.status    as string | undefined
  const priority  = req.query.priority  as string | undefined
  const result = await TmsService.listTasks(userId, { projectId, status: status as any, priority: priority as any, page, limit })
  res.json(result)
})

export const createTask = asyncHandler(async (req: Request, res: Response) => {
  const input = createTaskSchema.parse(req.body)
  const { userId } = auth(req)
  const task = await TmsService.createTask(userId, input)
  res.status(201).json({ task })
})

export const getTask = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = auth(req)
  const task = await TmsService.getTask(userId, req.params.id as string)
  if (!task) return res.status(404).json({ error: 'Task not found' })
  res.json({ task })
})

export const updateTask = asyncHandler(async (req: Request, res: Response) => {
  const input = updateTaskSchema.parse(req.body)
  const { userId } = auth(req)
  const task = await TmsService.updateTask(userId, req.params.id as string, input)
  if (!task) return res.status(404).json({ error: 'Task not found' })
  res.json({ task })
})

export const deleteTask = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = auth(req)
  const deleted = await TmsService.deleteTask(userId, req.params.id as string)
  if (!deleted) return res.status(404).json({ error: 'Task not found' })
  res.status(204).send()
})

export const completeTask = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = auth(req)
  const task = await TmsService.completeTask(userId, req.params.id as string)
  if (!task) return res.status(404).json({ error: 'Task not found' })
  res.json({ task })
})

export const reopenTask = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = auth(req)
  const task = await TmsService.reopenTask(userId, req.params.id as string)
  if (!task) return res.status(404).json({ error: 'Task not found' })
  res.json({ task })
})

export const textToProject = asyncHandler(async (req: Request, res: Response) => {
  const { text } = textToProjectSchema.parse(req.body)
  const { userId } = auth(req)
  const project = await TmsService.textToProject(userId, text)
  ActivityLogService.appendActivity({ action: 'tms.project.text_to_project', actorId: userId, targetType: 'project', targetId: project.id, targetName: project.title }).catch(() => {})
  res.status(201).json({ project })
})
