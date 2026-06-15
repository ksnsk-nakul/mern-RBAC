import type { Request, Response } from 'express'
import type mongoose from 'mongoose'
import { asyncHandler } from '../lib/errors.js'
import { z } from 'zod'
import * as ApiTokensService from '../services/apiTokens.service.js'

interface AuthUser { userId: mongoose.Types.ObjectId }
const auth = (req: Request): AuthUser => req.user as unknown as AuthUser

const createSchema = z.object({
  name:          z.string().min(1).max(80),
  scopes:        z.array(z.string()).min(1),
  expiresInDays: z.number().int().positive().optional(),
})

export const list = asyncHandler(async (req: Request, res: Response) => {
  const tokens = await ApiTokensService.listTokens(auth(req).userId)
  res.json({ tokens })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { name, scopes, expiresInDays } = createSchema.parse(req.body)
  const token = await ApiTokensService.createToken(auth(req).userId, name, scopes, expiresInDays)
  res.status(201).json({ token })
})

export const revoke = asyncHandler(async (req: Request, res: Response) => {
  await ApiTokensService.revokeToken(auth(req).userId, String(req.params.id))
  res.json({ ok: true })
})
