import type { Request, Response } from 'express'
import mongoose from 'mongoose'
import { asyncHandler, NotFoundError } from '../lib/errors.js'
import * as OrgsService from '../services/organizations.service.js'
import { z } from 'zod'

interface AuthUser {
  userId:      mongoose.Types.ObjectId
  roleId:      mongoose.Types.ObjectId
  permissions: string[]
}

export const listMyOrgs = asyncHandler(async (req: Request, res: Response) => {
  const auth = req.user as unknown as AuthUser
  const orgs = await OrgsService.listMyOrgs(auth.userId)
  res.json({ orgs })
})

export const switchOrg = asyncHandler(async (req: Request, res: Response) => {
  const auth = req.user as unknown as AuthUser
  const id   = req.params.id as string

  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError('Organization not found')

  await OrgsService.switchOrg(auth.userId, new mongoose.Types.ObjectId(id))
  res.json({ switched: true })
})

export const clearOrg = asyncHandler(async (req: Request, res: Response) => {
  const auth = req.user as unknown as AuthUser
  await OrgsService.switchOrg(auth.userId, null)
  res.json({ cleared: true })
})

export const acceptInvite = asyncHandler(async (req: Request, res: Response) => {
  const { token } = z.object({ token: z.string().min(1) }).parse(req.body)
  const auth      = req.user as unknown as AuthUser
  const membership = await OrgsService.acceptInvite(token, auth.userId)
  res.json({ membership })
})
