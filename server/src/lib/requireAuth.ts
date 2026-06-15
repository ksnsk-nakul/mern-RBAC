import type { Request, Response, NextFunction } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { tokenAuth }    from '../middleware/tokenAuth.js'
import { AuthError }    from './errors.js'

/**
 * Tries cookie JWT first, then falls back to API token Bearer header.
 * Attaches req.user on success; calls next(AuthError) if both fail.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  let resolved = false
  authenticate(req, res, (err?: unknown) => {
    if (!err && req.user) {
      resolved = true
      next()
    }
  })

  if (resolved) return

  await tokenAuth(req, res, (err?: unknown) => {
    if (err) return next(err)
    if (req.user) return next()
    next(new AuthError('No valid authentication'))
  })
}
