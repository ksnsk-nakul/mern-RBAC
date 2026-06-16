import type { Request, Response } from 'express'
import type mongoose from 'mongoose'
import { asyncHandler } from '../../lib/errors.js'
import * as UsersService from '../../services/users.service.js'
import * as ActivityLogService from '../../services/activityLog.service.js'

interface AuthUser {
  userId:      mongoose.Types.ObjectId
  roleId:      mongoose.Types.ObjectId
  permissions: string[]
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const search         = (req.query.search as string) || ''
  const page           = Number(req.query.page)  || 1
  const limit          = Number(req.query.limit) || 20
  const includeDeleted = req.query.includeDeleted === 'true'

  const result = await UsersService.listUsers({ search, page, limit, includeDeleted })
  res.json(result)
})

export const get = asyncHandler(async (req: Request, res: Response) => {
  const user = await UsersService.getUser(req.params.id as string)
  res.json({ user })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = UsersService.createUserSchema.parse(req.body)
  const auth  = req.user as unknown as AuthUser
  const user  = await UsersService.createUser(input, auth.userId)

  ActivityLogService.appendActivity({
    action:     'user.created',
    actorId:    auth.userId,
    targetType: 'user',
    targetId:   user.id,
    targetName: user.email,
  }).catch(() => {})

  res.status(201).json({ user })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const input = UsersService.updateUserSchema.parse(req.body)
  const auth  = req.user as unknown as AuthUser
  const user  = await UsersService.updateUser(req.params.id as string, input)

  ActivityLogService.appendActivity({
    action:     'user.updated',
    actorId:    auth.userId,
    targetType: 'user',
    targetId:   req.params.id as string,
    targetName: user.email,
    meta:       input as Record<string, unknown>,
  }).catch(() => {})

  res.json({ user })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const auth = req.user as unknown as AuthUser
  await UsersService.softDeleteUser(req.params.id as string, auth.userId)

  ActivityLogService.appendActivity({
    action:     'user.deleted',
    actorId:    auth.userId,
    targetType: 'user',
    targetId:   req.params.id as string,
  }).catch(() => {})

  res.json({ deleted: true })
})
