import type { Request, Response, NextFunction } from 'express'
import { verifyAndLoadToken } from '../services/apiTokens.service.js'

export async function tokenAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return next()
  }

  const raw = authHeader.slice(7)
  try {
    const token = await verifyAndLoadToken(raw)
    if (token) {
      req.user = {
        userId:      token.userId as any,
        roleId:      null as any,
        permissions: token.scopes,
      }
    }
  } catch (err) {
    return next(err)
  }

  next()
}
