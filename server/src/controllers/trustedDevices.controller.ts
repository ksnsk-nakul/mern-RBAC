import type { Request, Response } from 'express'
import type mongoose from 'mongoose'
import { asyncHandler } from '../lib/errors.js'
import * as DevicesService from '../services/trustedDevices.service.js'

interface AuthUser { userId: mongoose.Types.ObjectId }
const auth = (req: Request): AuthUser => req.user as unknown as AuthUser

export const list = asyncHandler(async (req: Request, res: Response) => {
  const devices = await DevicesService.listDevices(auth(req).userId)
  res.json({ devices })
})

export const trust = asyncHandler(async (req: Request, res: Response) => {
  const userAgent = req.headers['user-agent'] ?? ''
  const ip        = (req.ip ?? '').replace('::ffff:', '')
  const device    = await DevicesService.trustDevice(auth(req).userId, userAgent, ip)
  res.json({ device })
})

export const revoke = asyncHandler(async (req: Request, res: Response) => {
  await DevicesService.revokeDevice(auth(req).userId, String(req.params.id))
  res.json({ ok: true })
})

export const revokeAll = asyncHandler(async (req: Request, res: Response) => {
  await DevicesService.revokeAllDevices(auth(req).userId)
  res.json({ ok: true })
})
