import type { Request, Response } from 'express'
import { asyncHandler } from '../lib/errors.js'
import * as AuthService from '../services/auth.service.js'
import { setAuthCookies, clearAuthCookies } from '../lib/cookies.js'
import { z } from 'zod'

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body)
  const role = req.portal!.role

  const result = await AuthService.loginWithRole(email, password, role)

  setAuthCookies(res, result.accessToken, result.refreshToken)
  res.json({ user: result.user, role: result.role, redirectTo: result.redirectTo })
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
  const userClaim = req.user as unknown as { userId: string; roleId: string; permissions: string[] }
  const user = await User.findById(userClaim.userId).select('-password')
  if (!user) { res.status(404).json({ error: 'User not found' }); return }

  const role = await Role.findById(userClaim.roleId)

  res.json({
    user:        { id: String(user._id), name: user.name, email: user.email, avatarUrl: user.avatarUrl, isFounder: user.isFounder },
    role:        role ? { name: role.name, slug: role.slug, route: role.route, color: role.color } : null,
    permissions: userClaim.permissions,
  })
})
