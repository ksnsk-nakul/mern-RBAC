import type { Request, Response } from 'express'
import type mongoose from 'mongoose'
import { asyncHandler } from '../../lib/errors.js'
import { z } from 'zod'
import * as LoginConfigsService from '../../services/loginConfigs.service.js'

interface AuthUser {
  userId:      mongoose.Types.ObjectId
  roleId:      mongoose.Types.ObjectId
  permissions: string[]
}

const upsertSchema = z.object({
  template:          z.enum(['modal', 'centered', 'split']),
  bgImage:           z.string().url().nullable().optional(),
  logoUrl:           z.string().url().nullable().optional(),
  brandTitle:        z.string().min(1).optional(),
  brandSubtitle:     z.string().nullable().optional(),
  googleAuthEnabled: z.boolean().optional(),
})

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const configs = await LoginConfigsService.listLoginConfigs()
  res.json({ configs })
})

export const upsert = asyncHandler(async (req: Request, res: Response) => {
  const input  = upsertSchema.parse(req.body)
  const config = await LoginConfigsService.upsertLoginConfig(
    String(req.params.roleId),
    input,
    (req.user as unknown as AuthUser).userId,
  )
  res.json({ config })
})
