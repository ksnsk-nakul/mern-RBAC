import type { Request, Response } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { asyncHandler, ForbiddenError } from '../lib/errors.js'
import * as ApprovalRequestsService from '../services/approvalRequests.service.js'
import * as ActivityLogService from '../services/activityLog.service.js'

interface AuthUser {
  userId:      mongoose.Types.ObjectId
  permissions: string[]
}

const submitSchema = z.object({
  requestType:        z.enum(['role_assignment', 'permission_grant']),
  targetRoleId:       z.string().regex(/^[a-f\d]{24}$/i, 'Invalid role ID'),
  targetPermissionId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid permission ID').optional(),
  reason:             z.string().max(500).optional(),
})

export const submit = asyncHandler(async (req: Request, res: Response) => {
  const input = submitSchema.parse(req.body)
  const auth  = req.user as unknown as AuthUser

  if (input.requestType === 'permission_grant' && !auth.permissions.includes('*') && !auth.permissions.includes('roles.view')) {
    throw new ForbiddenError('Missing permission: roles.view')
  }

  const request = await ApprovalRequestsService.submitRequest(input, auth.userId)

  ActivityLogService.appendActivity({
    action:     'approval.requested',
    actorId:    auth.userId,
    targetType: 'approval_request',
    targetId:   request.id,
    meta:       { requestType: input.requestType, targetRoleId: input.targetRoleId },
  }).catch(() => {})

  res.status(201).json({ request })
})

export const mine = asyncHandler(async (req: Request, res: Response) => {
  const auth = req.user as unknown as AuthUser
  const requests = await ApprovalRequestsService.listMyRequests(auth.userId)
  res.json({ requests })
})
