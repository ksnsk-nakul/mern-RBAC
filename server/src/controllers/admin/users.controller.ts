import type { Request, Response } from 'express'
import type mongoose from 'mongoose'
import { asyncHandler } from '../../lib/errors.js'
import * as UsersService from '../../services/users.service.js'

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
  const user  = await UsersService.createUser(input, (req.user as unknown as AuthUser).userId)
  res.status(201).json({ user })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const input = UsersService.updateUserSchema.parse(req.body)
  const user  = await UsersService.updateUser(req.params.id as string, input)
  res.json({ user })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await UsersService.softDeleteUser(req.params.id as string, (req.user as unknown as AuthUser).userId)
  res.json({ deleted: true })
})
