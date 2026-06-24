import type { Request, Response } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { asyncHandler } from '../../lib/errors.js'
import * as RoleTemplatesService from '../../services/roleTemplates.service.js'
import * as ActivityLogService from '../../services/activityLog.service.js'

interface AuthUser { userId: mongoose.Types.ObjectId }

const createTemplateSchema = z.object({
  name:          z.string().min(1).max(100),
  description:   z.string().max(500).optional(),
  permissionIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1),
})

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const templates = await RoleTemplatesService.listTemplates()
  res.json({ templates })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createTemplateSchema.parse(req.body)
  const auth  = req.user as unknown as AuthUser

  const template = await RoleTemplatesService.createTemplate(input, auth.userId)

  ActivityLogService.appendActivity({
    action:     'role_template.created',
    actorId:    auth.userId,
    targetType: 'role_template',
    targetId:   template.id,
    targetName: template.name,
  }).catch(() => {})

  res.status(201).json({ template })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const auth = req.user as unknown as AuthUser
  await RoleTemplatesService.deleteTemplate(req.params.id as string)

  ActivityLogService.appendActivity({
    action:     'role_template.deleted',
    actorId:    auth.userId,
    targetType: 'role_template',
    targetId:   req.params.id as string,
  }).catch(() => {})

  res.json({ deleted: true })
})
