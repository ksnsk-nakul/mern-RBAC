import mongoose from 'mongoose'
import { UserRole } from '../models/UserRole.js'
import { Role } from '../models/Role.js'
import { User } from '../models/User.js'
import { NotFoundError, AppError } from '../lib/errors.js'

export interface UserRoleItem {
  id:         string
  roleId:     string
  roleName:   string
  roleSlug:   string
  roleColor:  string
  isPrimary:  boolean
  isActive:   boolean
  assignedAt: string
  assignedBy: string | null
}

export async function listUserRoles(userId: string): Promise<UserRoleItem[]> {
  const user = await User.findById(userId)
  if (!user) throw new NotFoundError('User not found')

  const userRoles = await UserRole.find({ userId })
    .populate<{ roleId: { _id: mongoose.Types.ObjectId; name: string; slug: string; color: string } }>(
      'roleId', 'name slug color',
    )
    .lean()

  return userRoles.map((ur) => ({
    id:         String(ur._id),
    roleId:     String((ur.roleId as any)._id),
    roleName:   (ur.roleId as any).name,
    roleSlug:   (ur.roleId as any).slug,
    roleColor:  (ur.roleId as any).color,
    isPrimary:  ur.isPrimary,
    isActive:   ur.isActive,
    assignedAt: ur.assignedAt.toISOString(),
    assignedBy: ur.assignedBy ? String(ur.assignedBy) : null,
  }))
}

export async function assignRole(
  userId: string,
  roleId: string,
  assignedBy: mongoose.Types.ObjectId,
): Promise<UserRoleItem[]> {
  const [user, role] = await Promise.all([
    User.findById(userId),
    Role.findById(roleId),
  ])
  if (!user) throw new NotFoundError('User not found')
  if (!role) throw new NotFoundError('Role not found')

  const existing = await UserRole.findOne({ userId, roleId })
  if (existing) {
    if (existing.isActive) throw new AppError('User already has this role', 409, 'CONFLICT')
    existing.isActive   = true
    existing.assignedBy = assignedBy
    existing.assignedAt = new Date()
    await existing.save()
  } else {
    const hasAny = await UserRole.exists({ userId, isActive: true })
    await UserRole.create({
      userId,
      roleId,
      isPrimary:  !hasAny,
      isActive:   true,
      assignedBy,
      assignedAt: new Date(),
    })
  }

  return listUserRoles(userId)
}

export async function revokeRole(
  userId: string,
  roleId: string,
): Promise<UserRoleItem[]> {
  const userRole = await UserRole.findOne({ userId, roleId, isActive: true })
  if (!userRole) throw new NotFoundError('User does not have this active role')

  userRole.isActive = false
  await userRole.save()

  return listUserRoles(userId)
}
