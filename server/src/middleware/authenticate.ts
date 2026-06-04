import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { AuthError } from '../lib/errors.js'

interface AccessPayload {
  sub: string
  roleId: string
  permissions: string[]
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.access_token as string | undefined

  if (!token) {
    return next(new AuthError('No access token'))
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload
    req.user = {
      userId:      payload.sub as any,
      roleId:      payload.roleId as any,
      permissions: payload.permissions,
    }
    next()
  } catch {
    next(new AuthError('Invalid or expired access token'))
  }
}
