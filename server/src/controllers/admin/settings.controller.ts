import type { Request, Response } from 'express'
import type mongoose from 'mongoose'
import { asyncHandler } from '../../lib/errors.js'
import * as SettingsService from '../../services/settings.service.js'

interface AuthUser {
  userId:      mongoose.Types.ObjectId
  roleId:      mongoose.Types.ObjectId
  permissions: string[]
}

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const grouped = await SettingsService.listSettings(false)
  res.json({ settings: grouped })
})

export const listPublic = asyncHandler(async (_req: Request, res: Response) => {
  const grouped = await SettingsService.listSettings(true)
  res.json({ settings: grouped })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const slug    = req.params.slug as string
  const { value } = req.body as { value: unknown }
  const setting = await SettingsService.updateSetting(slug, value, (req.user as unknown as AuthUser).userId)
  res.json({ setting })
})
