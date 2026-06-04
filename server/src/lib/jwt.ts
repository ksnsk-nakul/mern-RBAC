import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { env } from '../config/env.js'

const ACCESS_TTL  = 15 * 60
const REFRESH_TTL = 7 * 24 * 60 * 60

export function signAccessToken(payload: {
  sub: string
  roleId: string
  permissions: string[]
}): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL })
}

export function signRefreshToken(payload: { sub: string; roleId: string }): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL })
}

export function verifyRefreshToken(token: string): { sub: string; roleId: string } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string; roleId: string }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export const REFRESH_TTL_MS = REFRESH_TTL * 1000
export const ACCESS_TTL_MS  = ACCESS_TTL * 1000
