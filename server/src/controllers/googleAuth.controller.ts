import type { Request, Response } from 'express'
import { asyncHandler } from '../lib/errors.js'
import { UserRole } from '../models/UserRole.js'
import { Role } from '../models/Role.js'
import { signAccessToken, signRefreshToken, hashToken, REFRESH_TTL_MS } from '../lib/jwt.js'
import { RefreshToken } from '../models/RefreshToken.js'
import { setAuthCookies } from '../lib/cookies.js'
import mongoose from 'mongoose'

export const googleCallback = asyncHandler(async (req: Request, res: Response) => {
  const { userId, roleRoute } = req.user as any

  const role         = await Role.findOne({ route: roleRoute })
  const fallbackRole = await Role.findOne({ isDefault: true })
  const activeRole   = role ?? fallbackRole

  if (!activeRole) {
    res.redirect('/login/user?error=no_role')
    return
  }

  const userRole = await UserRole.findOne({ userId, roleId: activeRole._id, isActive: true })
  if (!userRole) {
    res.redirect(`/login/${activeRole.route}?error=no_access`)
    return
  }

  const permissions  = activeRole.slug === 'super_admin' ? ['*'] : []
  const accessToken  = signAccessToken({ sub: userId, roleId: String(activeRole._id), permissions })
  const refreshToken = signRefreshToken({ sub: userId, roleId: String(activeRole._id) })

  await RefreshToken.create({
    userId:    new mongoose.Types.ObjectId(userId),
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  })

  setAuthCookies(res, accessToken, refreshToken)
  res.redirect(`/${activeRole.route}`)
})
