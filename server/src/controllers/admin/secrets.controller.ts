import type { Request, Response } from 'express'
import type mongoose from 'mongoose'
import { asyncHandler, ForbiddenError } from '../../lib/errors.js'
import * as SecretsService from '../../services/secrets.service.js'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'

interface AuthUser {
  userId:      mongoose.Types.ObjectId
  roleId:      mongoose.Types.ObjectId
  permissions: string[]
}

// 10 reveals per user per minute
export const revealLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      10,
  keyGenerator: (req) => String((req as any).user?.userId ?? req.ip),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many reveal requests' },
})

function groupFromSlug(slug: string): string {
  return slug.split('.')[0] ?? ''
}

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const grouped = await SecretsService.listSecrets()
  res.json({ secrets: grouped })
})

export const reveal = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params
  const group    = groupFromSlug(String(slug))
  const required = `secrets.${group}.view`
  const auth     = req.user as unknown as AuthUser

  if (!auth.permissions.includes('*') && !auth.permissions.includes(required)) {
    throw new ForbiddenError(`Missing permission: ${required}`)
  }

  const value = await SecretsService.revealSecret(String(slug))
  res.json({ value })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params
  const group    = groupFromSlug(String(slug))
  const required = `secrets.${group}.manage`
  const auth     = req.user as unknown as AuthUser

  if (!auth.permissions.includes('*') && !auth.permissions.includes(required)) {
    throw new ForbiddenError(`Missing permission: ${required}`)
  }

  const { value } = z.object({ value: z.string().min(1) }).parse(req.body)
  const secret    = await SecretsService.setSecret(String(slug), value, auth.userId)
  res.json({ secret })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params
  const group    = groupFromSlug(String(slug))
  const required = `secrets.${group}.manage`
  const auth     = req.user as unknown as AuthUser

  if (!auth.permissions.includes('*') && !auth.permissions.includes(required)) {
    throw new ForbiddenError(`Missing permission: ${required}`)
  }

  const secret = await SecretsService.clearSecret(String(slug), auth.userId)
  res.json({ secret })
})
