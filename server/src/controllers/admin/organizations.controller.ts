import type { Request, Response } from 'express'
import type mongoose from 'mongoose'
import { asyncHandler } from '../../lib/errors.js'
import * as OrgsService from '../../services/organizations.service.js'
import { z } from 'zod'

interface AuthUser {
  userId:      mongoose.Types.ObjectId
  roleId:      mongoose.Types.ObjectId
  permissions: string[]
}

const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
})

const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
})

const addMemberSchema = z.object({
  userId:  z.string().min(1),
  orgRole: z.enum(['owner', 'admin', 'member']),
})

const inviteMemberSchema = z.object({
  userId:  z.string().min(1),
  orgRole: z.enum(['owner', 'admin', 'member']),
})

export const list = asyncHandler(async (req: Request, res: Response) => {
  const page   = Number(req.query.page)   || 1
  const limit  = Number(req.query.limit)  || 20
  const search = (req.query.search as string) || undefined

  const result = await OrgsService.listOrgs({ page, limit, search })
  res.json(result)
})

export const get = asyncHandler(async (req: Request, res: Response) => {
  const org = await OrgsService.getOrg(req.params.id as string)
  res.json({ org })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createOrgSchema.parse(req.body)
  const auth  = req.user as unknown as AuthUser
  const org   = await OrgsService.createOrg(input, auth.userId)
  res.status(201).json({ org })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const input = updateOrgSchema.parse(req.body)
  const org   = await OrgsService.updateOrg(req.params.id as string, input)
  res.json({ org })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await OrgsService.deleteOrg(req.params.id as string)
  res.json({ deleted: true })
})

export const listMembers = asyncHandler(async (req: Request, res: Response) => {
  const mn = (await import('mongoose')).default
  const { NotFoundError } = await import('../../lib/errors.js')
  const id = req.params.id as string
  if (!mn.Types.ObjectId.isValid(id)) throw new NotFoundError('Organization not found')
  const members = await OrgsService.listMembers(new mn.Types.ObjectId(id))
  res.json({ members })
})

export const addMember = asyncHandler(async (req: Request, res: Response) => {
  const { userId, orgRole } = addMemberSchema.parse(req.body)
  const mn    = (await import('mongoose')).default
  const orgId = new mn.Types.ObjectId(req.params.id as string)
  const uId   = new mn.Types.ObjectId(userId)
  const member = await OrgsService.addMember(orgId, uId, orgRole)
  res.status(201).json({ member })
})

export const inviteMember = asyncHandler(async (req: Request, res: Response) => {
  const { userId, orgRole } = inviteMemberSchema.parse(req.body)
  const auth  = req.user as unknown as AuthUser
  const mn    = (await import('mongoose')).default
  const orgId = new mn.Types.ObjectId(req.params.id as string)
  const uId   = new mn.Types.ObjectId(userId)
  const result = await OrgsService.inviteMember(orgId, uId, orgRole, auth.userId)
  res.status(201).json(result)
})

export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  const mn    = (await import('mongoose')).default
  const orgId = new mn.Types.ObjectId(req.params.id as string)
  const uId   = new mn.Types.ObjectId(req.params.userId as string)
  await OrgsService.removeMember(orgId, uId)
  res.json({ removed: true })
})
