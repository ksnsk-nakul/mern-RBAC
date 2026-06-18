import type { Request, Response } from 'express'
import mongoose from 'mongoose'
import { asyncHandler } from '../../lib/errors.js'
import * as UserRolesService from '../../services/userRoles.service.js'
import * as WebhooksService from '../../services/webhooks.service.js'

interface AuthUser {
  userId:      mongoose.Types.ObjectId
  roleId:      mongoose.Types.ObjectId
  permissions: string[]
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const userRoles = await UserRolesService.listUserRoles(req.params.userId as string)
  res.json({ userRoles })
})

export const assign = asyncHandler(async (req: Request, res: Response) => {
  const { roleId } = req.body as { roleId: string }
  const userRoles  = await UserRolesService.assignRole(req.params.userId as string, roleId, (req.user as unknown as AuthUser).userId)
  try {
    WebhooksService.dispatchEvent(
      'user.role_changed',
      new mongoose.Types.ObjectId(req.params.userId as string),
      { action: 'assigned', roleId },
    ).catch((err) => console.error('webhook dispatch failed (user.role_changed):', err))
  } catch (err) {
    console.error('webhook dispatch failed (user.role_changed):', err)
  }
  res.status(201).json({ userRoles })
})

export const revoke = asyncHandler(async (req: Request, res: Response) => {
  const userRoles = await UserRolesService.revokeRole(req.params.userId as string, req.params.roleId as string)
  try {
    WebhooksService.dispatchEvent(
      'user.role_changed',
      new mongoose.Types.ObjectId(req.params.userId as string),
      { action: 'revoked', roleId: req.params.roleId },
    ).catch((err) => console.error('webhook dispatch failed (user.role_changed):', err))
  } catch (err) {
    console.error('webhook dispatch failed (user.role_changed):', err)
  }
  res.json({ userRoles })
})
