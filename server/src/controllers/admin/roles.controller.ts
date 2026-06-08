import type { Request, Response } from 'express'
import { asyncHandler } from '../../lib/errors.js'
import * as RolesService from '../../services/roles.service.js'

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
  const role  = await RolesService.createRole(input)
  res.status(201).json({ role })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const input = RolesService.updateRoleSchema.parse(req.body)
  const role  = await RolesService.updateRole(req.params.id as string, input)
  res.json({ role })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await RolesService.deleteRole(req.params.id as string)
  res.json({ deleted: true })
})

export const setPermissions = asyncHandler(async (req: Request, res: Response) => {
  const { permissionIds } = req.body as { permissionIds: string[] }
  const role = await RolesService.setRolePermissions(req.params.id as string, permissionIds ?? [])
  res.json({ role })
})
