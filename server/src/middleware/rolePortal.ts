import type { Request, Response, NextFunction } from 'express'
import { Role } from '../models/Role.js'
import { NotFoundError } from '../lib/errors.js'

export async function rolePortal(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const { roleRoute } = req.params

  const role = await Role.findOne({ route: roleRoute })

  if (!role) {
    return next(new NotFoundError(`Login portal "${roleRoute}" not found`))
  }

  req.portal = { role: role as any }
  next()
}
