import type { Request, Response, NextFunction } from 'express'
import mongoose from 'mongoose'
import { OrganizationUser, type OrgRole } from '../models/OrganizationUser.js'
import { ForbiddenError, NotFoundError, AuthError } from '../lib/errors.js'

interface AuthUser { userId: mongoose.Types.ObjectId }

export function requireOrgRole(roles: OrgRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    void (async () => {
      if (!req.user) { next(new AuthError()); return }
      const auth  = req.user as unknown as AuthUser
      const orgId = req.params.orgId as string

      if (!mongoose.Types.ObjectId.isValid(orgId)) { next(new NotFoundError('Organization not found')); return }

      const membership = await OrganizationUser.findOne({
        orgId:   new mongoose.Types.ObjectId(orgId),
        userId:  auth.userId,
        status:  'active',
        orgRole: { $in: roles },
      })

      if (!membership) { next(new ForbiddenError('You do not have permission to manage this organization')); return }

      next()
    })().catch(next)
  }
}
