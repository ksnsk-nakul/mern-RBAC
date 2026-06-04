import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { Role } from '../models/Role.js'
import { UserRole } from '../models/UserRole.js'
import { RefreshToken } from '../models/RefreshToken.js'
import { AuthError, ForbiddenError } from '../lib/errors.js'
import { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken, REFRESH_TTL_MS } from '../lib/jwt.js'
import type { IRole } from '../models/Role.js'

export interface AuthResult {
  user:         { id: string; name: string; email: string; avatarUrl?: string; isFounder: boolean }
  role:         { name: string; slug: string; route: string; color: string }
  accessToken:  string
  refreshToken: string
  redirectTo:   string
}

async function resolvePermissions(roleId: mongoose.Types.ObjectId): Promise<string[]> {
  const role = await Role.findById(roleId)
  if (!role) return []
  if (role.slug === 'super_admin') return ['*']
  return []
}

export async function loginWithRole(
  email: string,
  password: string,
  role: IRole & { _id: mongoose.Types.ObjectId },
): Promise<AuthResult> {
  const user = await User.findOne({ email: email.toLowerCase(), deletedAt: null })
  if (!user) throw new AuthError('Invalid credentials')

  if (!user.password) throw new AuthError('Use Google login for this account')

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) throw new AuthError('Invalid credentials')

  const userRole = await UserRole.findOne({ userId: user._id, roleId: role._id, isActive: true })
  if (!userRole) throw new ForbiddenError('You do not have access to this portal')

  const permissions = await resolvePermissions(role._id)

  const accessToken  = signAccessToken({ sub: String(user._id), roleId: String(role._id), permissions })
  const refreshToken = signRefreshToken({ sub: String(user._id), roleId: String(role._id) })

  await RefreshToken.create({
    userId:    user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  })

  return {
    user:        { id: String(user._id), name: user.name, email: user.email, avatarUrl: user.avatarUrl, isFounder: user.isFounder },
    role:        { name: role.name, slug: role.slug, route: role.route, color: role.color },
    accessToken,
    refreshToken,
    redirectTo:  `/${role.route}`,
  }
}

export async function refreshTokens(rawToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  let payload: { sub: string; roleId: string }
  try {
    payload = verifyRefreshToken(rawToken)
  } catch {
    throw new AuthError('Invalid refresh token')
  }

  const stored = await RefreshToken.findOne({ tokenHash: hashToken(rawToken) })
  if (!stored) throw new AuthError('Refresh token revoked')

  await stored.deleteOne()

  const permissions  = await resolvePermissions(new mongoose.Types.ObjectId(payload.roleId))
  const accessToken  = signAccessToken({ sub: payload.sub, roleId: payload.roleId, permissions })
  const refreshToken = signRefreshToken({ sub: payload.sub, roleId: payload.roleId })

  await RefreshToken.create({
    userId:    new mongoose.Types.ObjectId(payload.sub),
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  })

  return { accessToken, refreshToken }
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  if (!rawToken) return
  await RefreshToken.deleteOne({ tokenHash: hashToken(rawToken) })
}
