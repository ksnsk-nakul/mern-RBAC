import type { Request, Response } from 'express'
import { asyncHandler } from '../../lib/errors.js'
import { Permission } from '../../models/Permission.js'

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const permissions = await Permission.find().sort({ mainGroup: 1, name: 1 }).lean()
  res.json({
    permissions: permissions.map((p) => ({
      id:          String(p._id),
      name:        p.name,
      slug:        p.slug,
      mainGroup:   p.mainGroup,
      isProtected: p.isProtected,
    })),
  })
})
