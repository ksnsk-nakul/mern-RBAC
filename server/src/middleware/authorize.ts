import type { Request, Response, NextFunction } from 'express'
import { ForbiddenError, AuthError } from '../lib/errors.js'

export function authorize(permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthError())
    }
    const userClaim = req.user as unknown as { userId: string; roleId: string; permissions: string[] }
    if (userClaim.permissions.includes('*')) {
      return next()
    }
    if (!userClaim.permissions.includes(permission)) {
      return next(new ForbiddenError(`Missing permission: ${permission}`))
    }
    next()
  }
}
