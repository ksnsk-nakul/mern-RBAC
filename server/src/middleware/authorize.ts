import type { Request, Response, NextFunction } from 'express'
import { ForbiddenError, AuthError } from '../lib/errors.js'

export function authorize(permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthError())
    }
    if (req.user.permissions.includes('*')) {
      return next()
    }
    if (!req.user.permissions.includes(permission)) {
      return next(new ForbiddenError(`Missing permission: ${permission}`))
    }
    next()
  }
}
