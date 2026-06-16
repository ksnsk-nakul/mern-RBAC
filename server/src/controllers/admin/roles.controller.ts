import type { Request, Response } from 'express'
import type mongoose from 'mongoose'
import { asyncHandler } from '../../lib/errors.js'
import * as RolesService from '../../services/roles.service.js'
import * as ActivityLogService from '../../services/activityLog.service.js'

interface AuthUser {
  userId:      mongoose.Types.ObjectId
  roleId:      mongoose.Types.ObjectId
  permissions: string[]
}

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const roles = await RolesService.listRoles()
  res.json({ roles })
})

export const get = asyncHandler(async (req: Request, res: Response) => {
  const role = await RolesService.getRole(req.params.id as string)
  res.json({ role })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = RolesService.createRoleSchema.parse(req.body)
  const auth  = req.user as unknown as AuthUser
  const role  = await RolesService.createRole(input)

  ActivityLogService.appendActivity({
    action:     'role.created',
    actorId:    auth.userId,
    targetType: 'role',
    targetId:   role.id,
    targetName: role.slug,
  }).catch(() => {})

  res.status(201).json({ role })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const input = RolesService.updateRoleSchema.parse(req.body)
  const auth  = req.user as unknown as AuthUser
  const role  = await RolesService.updateRole(req.params.id as string, input)

  ActivityLogService.appendActivity({
    action:     'role.updated',
    actorId:    auth.userId,
    targetType: 'role',
    targetId:   req.params.id as string,
    targetName: role.slug,
    meta:       input as Record<string, unknown>,
  }).catch(() => {})

  res.json({ role })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const auth = req.user as unknown as AuthUser
  await RolesService.deleteRole(req.params.id as string)

  ActivityLogService.appendActivity({
    action:     'role.deleted',
    actorId:    auth.userId,
    targetType: 'role',
    targetId:   req.params.id as string,
  }).catch(() => {})

  res.json({ deleted: true })
})

export const setPermissions = asyncHandler(async (req: Request, res: Response) => {
  const { permissionIds } = req.body as { permissionIds: string[] }
  const auth = req.user as unknown as AuthUser
  const role = await RolesService.setRolePermissions(req.params.id as string, permissionIds ?? [])

  ActivityLogService.appendActivity({
    action:     'role.permissions_updated',
    actorId:    auth.userId,
    targetType: 'role',
    targetId:   req.params.id as string,
    targetName: role.slug,
    meta:       { permissionCount: permissionIds?.length ?? 0 },
  }).catch(() => {})

  res.json({ role })
})
