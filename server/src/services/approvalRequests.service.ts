import mongoose from 'mongoose'
import { ApprovalRequest, type RequestType, type RequestStatus } from '../models/ApprovalRequest.js'
import { NotFoundError, AppError } from '../lib/errors.js'
import * as UserRolesService from './userRoles.service.js'
import * as RolesService from './roles.service.js'

export interface ApprovalRequestItem {
  id:                  string
  requestType:         RequestType
  requestedBy:         string
  targetUserId?:       string
  targetRoleId:        string
  targetPermissionId?: string
  status:              RequestStatus
  reason?:             string
  decisionNote?:       string
  approvedBy?:         string
  decidedAt?:          string
  createdAt:           string
}

interface ApprovalRequestLean {
  _id:                 mongoose.Types.ObjectId
  requestType:         RequestType
  requestedBy:         mongoose.Types.ObjectId
  targetUserId?:       mongoose.Types.ObjectId
  targetRoleId:        mongoose.Types.ObjectId
  targetPermissionId?: mongoose.Types.ObjectId
  status:              RequestStatus
  reason?:             string
  decisionNote?:       string
  approvedBy?:         mongoose.Types.ObjectId
  decidedAt?:          Date
  createdAt:           Date
}

function toItem(r: ApprovalRequestLean): ApprovalRequestItem {
  return {
    id:                 String(r._id),
    requestType:        r.requestType,
    requestedBy:        String(r.requestedBy),
    targetUserId:       r.targetUserId ? String(r.targetUserId) : undefined,
    targetRoleId:       String(r.targetRoleId),
    targetPermissionId: r.targetPermissionId ? String(r.targetPermissionId) : undefined,
    status:             r.status,
    reason:             r.reason,
    decisionNote:       r.decisionNote,
    approvedBy:         r.approvedBy ? String(r.approvedBy) : undefined,
    decidedAt:          r.decidedAt?.toISOString(),
    createdAt:          r.createdAt?.toISOString() ?? '',
  }
}

export interface SubmitRequestInput {
  requestType:         RequestType
  targetRoleId:        string
  targetPermissionId?: string
  reason?:             string
}

export async function submitRequest(input: SubmitRequestInput, requesterId: mongoose.Types.ObjectId): Promise<ApprovalRequestItem> {
  if (input.requestType === 'permission_grant' && !input.targetPermissionId) {
    throw new AppError('targetPermissionId is required for permission_grant requests', 400)
  }

  const doc = await ApprovalRequest.create({
    requestType:        input.requestType,
    requestedBy:        requesterId,
    targetUserId:        input.requestType === 'role_assignment' ? requesterId : undefined,
    targetRoleId:        new mongoose.Types.ObjectId(input.targetRoleId),
    targetPermissionId:  input.requestType === 'permission_grant' && input.targetPermissionId
                           ? new mongoose.Types.ObjectId(input.targetPermissionId)
                           : undefined,
    reason:              input.reason,
    status:              'pending',
  })

  return toItem(doc as unknown as ApprovalRequestLean)
}

export async function listMyRequests(requesterId: mongoose.Types.ObjectId): Promise<ApprovalRequestItem[]> {
  const requests = await ApprovalRequest.find({ requestedBy: requesterId }).sort({ createdAt: -1 }).lean()
  return (requests as unknown as ApprovalRequestLean[]).map(toItem)
}

export async function listRequests(opts: {
  status?: RequestStatus
  page?:   number
  limit?:  number
}): Promise<{ requests: ApprovalRequestItem[]; total: number; pages: number }> {
  const page  = opts.page  ?? 1
  const limit = opts.limit ?? 20
  const skip  = (page - 1) * limit

  const filter: Record<string, unknown> = {}
  if (opts.status) filter.status = opts.status

  const [requests, total] = await Promise.all([
    ApprovalRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ApprovalRequest.countDocuments(filter),
  ])

  return {
    requests: (requests as unknown as ApprovalRequestLean[]).map(toItem),
    total,
    pages: Math.ceil(total / limit),
  }
}

export async function approveRequest(
  id:           string,
  approverId:   mongoose.Types.ObjectId,
  decisionNote?: string,
): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError('Approval request not found')
  const request = await ApprovalRequest.findById(id)
  if (!request) throw new NotFoundError('Approval request not found')
  if (request.status !== 'pending') throw new AppError('Only pending requests can be approved', 409)

  if (request.requestType === 'role_assignment') {
    await UserRolesService.assignRole(String(request.targetUserId), String(request.targetRoleId), approverId)
  } else {
    const role = await RolesService.getRole(String(request.targetRoleId))
    const existingIds = role.permissions.map((p) => p.id)
    const newPermissionId = String(request.targetPermissionId)
    const mergedIds = existingIds.includes(newPermissionId) ? existingIds : [...existingIds, newPermissionId]
    await RolesService.setRolePermissions(String(request.targetRoleId), mergedIds)
  }

  request.status       = 'approved'
  request.approvedBy   = approverId
  request.decisionNote = decisionNote
  request.decidedAt    = new Date()
  await request.save()
}

export async function rejectRequest(
  id:           string,
  approverId:   mongoose.Types.ObjectId,
  decisionNote?: string,
): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError('Approval request not found')
  const request = await ApprovalRequest.findById(id)
  if (!request) throw new NotFoundError('Approval request not found')
  if (request.status !== 'pending') throw new AppError('Only pending requests can be rejected', 409)

  request.status       = 'rejected'
  request.approvedBy   = approverId
  request.decisionNote = decisionNote
  request.decidedAt    = new Date()
  await request.save()
}
