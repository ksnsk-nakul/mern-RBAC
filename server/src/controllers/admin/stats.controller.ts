import type { Request, Response } from 'express'
import { asyncHandler } from '../../lib/errors.js'
import { User } from '../../models/User.js'
import { Role } from '../../models/Role.js'
import { RefreshToken } from '../../models/RefreshToken.js'
import { UserRole } from '../../models/UserRole.js'

export const getStats = asyncHandler(async (_req: Request, res: Response) => {
  const [userCount, roleCount, activeSessionCount, recentAssignments] = await Promise.all([
    User.countDocuments({ deletedAt: null }),
    Role.countDocuments(),
    RefreshToken.countDocuments({ expiresAt: { $gt: new Date() } }),
    UserRole.find({ isActive: true })
      .sort({ assignedAt: -1 })
      .limit(5)
      .populate<{ userId: { _id: unknown; name: string; email: string } }>('userId', 'name email')
      .populate<{ roleId: { _id: unknown; name: string; color: string } }>('roleId', 'name color')
      .lean(),
  ])

  res.json({
    userCount,
    roleCount,
    activeSessionCount,
    recentAssignments: recentAssignments.map((a) => ({
      userName:   (a.userId as any)?.name  ?? 'Unknown',
      userEmail:  (a.userId as any)?.email ?? '',
      roleName:   (a.roleId as any)?.name  ?? 'Unknown',
      roleColor:  (a.roleId as any)?.color ?? '#6366f1',
      assignedAt: a.assignedAt.toISOString(),
    })),
  })
})
