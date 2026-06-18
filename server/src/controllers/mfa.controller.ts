import type { Request, Response } from 'express'
import type mongoose from 'mongoose'
import { asyncHandler } from '../lib/errors.js'
import { z } from 'zod'
import * as MfaService from '../services/mfa.service.js'
import * as WebhooksService from '../services/webhooks.service.js'

interface AuthUser { userId: mongoose.Types.ObjectId; permissions: string[] }
const auth = (req: Request): AuthUser => req.user as unknown as AuthUser

export const status = asyncHandler(async (req: Request, res: Response) => {
  const result = await MfaService.getMfaStatus(auth(req).userId)
  res.json(result)
})

export const setup = asyncHandler(async (req: Request, res: Response) => {
  const result = await MfaService.generateMfaSetup(auth(req).userId, 'RBAC App')
  res.json(result)
})

export const enable = asyncHandler(async (req: Request, res: Response) => {
  const { totpCode } = z.object({ totpCode: z.string().length(6) }).parse(req.body)
  await MfaService.verifyAndEnableMfa(auth(req).userId, totpCode)
  try {
    WebhooksService.dispatchEvent('mfa.enabled', auth(req).userId, {})
      .catch((err) => console.error('webhook dispatch failed (mfa.enabled):', err))
  } catch (err) {
    console.error('webhook dispatch failed (mfa.enabled):', err)
  }
  res.json({ ok: true })
})

export const disable = asyncHandler(async (req: Request, res: Response) => {
  const { totpCode } = z.object({ totpCode: z.string().length(6) }).parse(req.body)
  await MfaService.disableMfa(auth(req).userId, totpCode)
  try {
    WebhooksService.dispatchEvent('mfa.disabled', auth(req).userId, {})
      .catch((err) => console.error('webhook dispatch failed (mfa.disabled):', err))
  } catch (err) {
    console.error('webhook dispatch failed (mfa.disabled):', err)
  }
  res.json({ ok: true })
})

export const regenerateCodes = asyncHandler(async (req: Request, res: Response) => {
  const { totpCode } = z.object({ totpCode: z.string().length(6) }).parse(req.body)
  const codes = await MfaService.regenerateRecoveryCodes(auth(req).userId, totpCode)
  res.json({ recoveryCodes: codes })
})
