import type { Request, Response } from 'express'
import crypto from 'crypto'
import mongoose from 'mongoose'
import { asyncHandler } from '../lib/errors.js'
import * as AuthService from '../services/auth.service.js'
import { setAuthCookies, clearAuthCookies } from '../lib/cookies.js'
import { z } from 'zod'
import * as LoginActivity from '../services/loginActivity.service.js'
import * as WebhooksService from '../services/webhooks.service.js'

const loginSchema = z.object({
  email:        z.string().email(),
  password:     z.string().min(1),
  totpCode:     z.string().optional(),
  recoveryCode: z.string().optional(),
})

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, totpCode, recoveryCode } = loginSchema.parse(req.body)
  const role = req.portal!.role

  const userAgent = req.headers['user-agent'] ?? ''
  const ip        = (req.ip ?? '').replace('::ffff:', '')
  const deviceFingerprint = crypto.createHash('sha256').update(`${userAgent}:${ip}`).digest('hex')

  let loginResult: Awaited<ReturnType<typeof AuthService.loginWithRole>> | null = null
  let loginError:  Error | null = null

  try {
    loginResult = await AuthService.loginWithRole(email, password, role, {
      totpCode,
      recoveryCode,
      deviceFingerprint,
    })
  } catch (err) {
    loginError = err as Error
  }

  // Record login attempt — fire and forget, never let it block the response
  if (loginResult?.status !== 'mfa_required') {
    LoginActivity.recordLogin({
      ip,
      userAgent,
      roleSlug:   role.slug,
      success:    loginResult?.status === 'ok',
      failReason: loginError?.message,
    }).catch(() => {})
  }

  if (loginResult?.status === 'ok') {
    WebhooksService.dispatchEvent(
      'login.success',
      new mongoose.Types.ObjectId(loginResult.auth.user.id),
      { email, ip, userAgent },
    ).catch(() => {})
  } else if (loginResult?.status !== 'mfa_required') {
    void (async () => {
      const { User } = await import('../models/User.js')
      const failedUser = await User.findOne({ email: email.toLowerCase() }).select('_id').lean()
      if (failedUser) {
        await WebhooksService.dispatchEvent(
          'login.failed',
          failedUser._id as mongoose.Types.ObjectId,
          { email, ip, userAgent, reason: loginError?.message },
        )
      }
    })().catch(() => {})
  }

  if (loginError) throw loginError

  if (loginResult!.status === 'mfa_required') {
    res.json({ mfaRequired: true })
    return
  }

  setAuthCookies(res, loginResult!.auth.accessToken, loginResult!.auth.refreshToken)
  res.json({ user: loginResult!.auth.user, role: loginResult!.auth.role, redirectTo: loginResult!.auth.redirectTo })
})

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.refresh_token as string | undefined
  if (!rawToken) {
    res.status(401).json({ error: 'No refresh token' })
    return
  }

  const { accessToken, refreshToken } = await AuthService.refreshTokens(rawToken)
  setAuthCookies(res, accessToken, refreshToken)
  res.json({ ok: true })
})

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.refresh_token as string | undefined
  await AuthService.revokeRefreshToken(rawToken ?? '')
  clearAuthCookies(res)
  res.json({ ok: true })
})

export const loginConfig = asyncHandler(async (req: Request, res: Response) => {
  const { LoginConfig } = await import('../models/LoginConfig.js')
  const role = req.portal!.role
  const config = await LoginConfig.findOne({ roleId: role._id })

  res.json({
    roleRoute:         role.route,
    template:          config?.template ?? 'centered',
    bgImage:           config?.bgImage ?? null,
    logoUrl:           config?.logoUrl ?? null,
    brandTitle:        config?.brandTitle ?? 'Sign in',
    brandSubtitle:     config?.brandSubtitle ?? null,
    googleAuthEnabled: config?.googleAuthEnabled ?? false,
    roleColor:         role.color,
  })
})

export const me = asyncHandler(async (req: Request, res: Response) => {
  const { User } = await import('../models/User.js')
  const { Role } = await import('../models/Role.js')
  const userClaim = req.user as unknown as { userId: mongoose.Types.ObjectId; roleId: mongoose.Types.ObjectId; permissions: string[] }

  const user = await User.findById(userClaim.userId)
    .select('-password')
    .populate<{ currentOrganization: { _id: mongoose.Types.ObjectId; name: string; slug: string } | null }>(
      'currentOrganization', 'name slug',
    )

  if (!user) { res.status(404).json({ error: 'User not found' }); return }

  const role = await Role.findById(userClaim.roleId)

  const currentOrg = user.currentOrganization && typeof (user.currentOrganization as any)._id !== 'undefined'
    ? {
        id:   String((user.currentOrganization as any)._id),
        name: (user.currentOrganization as any).name as string,
        slug: (user.currentOrganization as any).slug as string,
      }
    : null

  res.json({
    user:        {
      id:         String(user._id),
      name:       user.name,
      email:      user.email,
      avatarUrl:  user.avatarUrl,
      isFounder:  user.isFounder,
      currentOrg,
    },
    role:        role ? { name: role.name, slug: role.slug, route: role.route, color: role.color } : null,
    permissions: userClaim.permissions,
  })
})
