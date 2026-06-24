import type { Request, Response } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { asyncHandler } from '../../lib/errors.js'
import * as ApprovalRequestsService from '../../services/approvalRequests.service.js'
import * as ActivityLogService from '../../services/activityLog.service.js'

interface AuthUser { userId: mongoose.Types.ObjectId }

const decisionSchema = z.object({
  decisionNote: z.string().max(500).optional(),
})

export const list = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as 'pending' | 'approved' | 'rejected' | undefined
  const page   = Number(req.query.page)  || 1
  const limit  = Math.min(Number(req.query.limit) || 20, 100)

  const result = await ApprovalRequestsService.listRequests({ status, page, limit })
  res.json(result)
})

export const approve = asyncHandler(async (req: Request, res: Response) => {
  const { decisionNote } = decisionSchema.parse(req.body)
  const auth = req.user as unknown as AuthUser

  await ApprovalRequestsService.approveRequest(req.params.id as string, auth.userId, decisionNote)

  ActivityLogService.appendActivity({
    action:     'approval.approved',
    actorId:    auth.userId,
    targetType: 'approval_request',
    targetId:   req.params.id as string,
    meta:       decisionNote ? { decisionNote } : undefined,
  }).catch(() => {})

  res.json({ approved: true })
})

export const reject = asyncHandler(async (req: Request, res: Response) => {
  const { decisionNote } = decisionSchema.parse(req.body)
  const auth = req.user as unknown as AuthUser

  await ApprovalRequestsService.rejectRequest(req.params.id as string, auth.userId, decisionNote)

  ActivityLogService.appendActivity({
    action:     'approval.rejected',
    actorId:    auth.userId,
    targetType: 'approval_request',
    targetId:   req.params.id as string,
    meta:       decisionNote ? { decisionNote } : undefined,
  }).catch(() => {})

  res.json({ rejected: true })
})
