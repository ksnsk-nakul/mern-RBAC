import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { User, type IUser } from '../models/User.js'
import { UserRole } from '../models/UserRole.js'
import { Role } from '../models/Role.js'
import { NotFoundError, AppError } from '../lib/errors.js'
import { z } from 'zod'

export const createUserSchema = z.object({
  name:      z.string().min(1).max(100),
  email:     z.string().email(),
  password:  z.string().min(8),
  isFounder: z.boolean().optional().default(false),
  roleIds:   z.array(z.string()).optional().default([]),
})

export const updateUserSchema = z.object({
  name:      z.string().min(1).max(100).optional(),
  isFounder: z.boolean().optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>

export interface UserListItem {
  id:          string
  name:        string
  email:       string
  avatarUrl:   string | undefined
  isFounder:   boolean
  roles:       Array<{ id: string; name: string; slug: string; color: string }>
  createdAt:   string
  deletedAt:   string | null
}

export async function listUsers(opts: {
  search?: string
  page?: number
  limit?: number
  includeDeleted?: boolean
}): Promise<{ users: UserListItem[]; total: number }> {
  const { search = '', page = 1, limit = 20, includeDeleted = false } = opts
  const skip = (page - 1) * limit

  const filter: mongoose.FilterQuery<IUser> = {}
  if (!includeDeleted) filter.deletedAt = null
  if (search) {
    filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ]
  }

  const [users, total] = await Promise.all([
    User.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
    User.countDocuments(filter),
  ])

  const userIds   = users.map((u) => u._id)
  const userRoles = await UserRole.find({ userId: { $in: userIds }, isActive: true })
    .populate<{ roleId: { _id: mongoose.Types.ObjectId; name: string; slug: string; color: string } }>('roleId', 'name slug color')
    .lean()

  const rolesByUser = new Map<string, Array<{ id: string; name: string; slug: string; color: string }>>()
  for (const ur of userRoles) {
    const uid = String(ur.userId)
    if (!rolesByUser.has(uid)) rolesByUser.set(uid, [])
    if (ur.roleId && typeof ur.roleId === 'object') {
      rolesByUser.get(uid)!.push({
        id:    String(ur.roleId._id),
        name:  ur.roleId.name,
        slug:  ur.roleId.slug,
        color: ur.roleId.color,
      })
    }
  }

  return {
    total,
    users: users.map((u) => ({
      id:        String(u._id),
      name:      u.name,
      email:     u.email,
      avatarUrl: u.avatarUrl,
      isFounder: u.isFounder,
      roles:     rolesByUser.get(String(u._id)) ?? [],
      createdAt: (u as any).createdAt?.toISOString?.() ?? '',
      deletedAt: u.deletedAt ? u.deletedAt.toISOString() : null,
    })),
  }
}

export async function getUser(id: string): Promise<UserListItem> {
  const user = await User.findById(id).lean()
  if (!user) throw new NotFoundError('User not found')

  const userRoles = await UserRole.find({ userId: user._id, isActive: true })
    .populate<{ roleId: { _id: mongoose.Types.ObjectId; name: string; slug: string; color: string } }>('roleId', 'name slug color')
    .lean()

  return {
    id:        String(user._id),
    name:      user.name,
    email:     user.email,
    avatarUrl: user.avatarUrl,
    isFounder: user.isFounder,
    roles:     userRoles.map((ur) => ({
      id:    String((ur.roleId as any)._id),
      name:  (ur.roleId as any).name,
      slug:  (ur.roleId as any).slug,
      color: (ur.roleId as any).color,
    })),
    createdAt: (user as any).createdAt?.toISOString?.() ?? '',
    deletedAt: user.deletedAt ? user.deletedAt.toISOString() : null,
  }
}

export async function createUser(input: CreateUserInput, createdBy?: mongoose.Types.ObjectId): Promise<UserListItem> {
  const existing = await User.findOne({ email: input.email.toLowerCase() })
  if (existing) throw new AppError('Email already in use', 409, 'CONFLICT')

  const hashed = await bcrypt.hash(input.password, 12)
  const user   = await User.create({
    name:      input.name,
    email:     input.email.toLowerCase(),
    password:  hashed,
    isFounder: input.isFounder,
  })

  if (input.roleIds.length > 0) {
    const roles = await Role.find({ _id: { $in: input.roleIds } })
    for (const role of roles) {
      await UserRole.create({
        userId:     user._id,
        roleId:     role._id,
        isPrimary:  false,
        isActive:   true,
        assignedBy: createdBy,
        assignedAt: new Date(),
      })
    }
  }

  return getUser(String(user._id))
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<UserListItem> {
  const user = await User.findById(id)
  if (!user) throw new NotFoundError('User not found')
  if (user.deletedAt) throw new AppError('Cannot update a deleted user', 400, 'BAD_REQUEST')

  if (input.name      !== undefined) user.name      = input.name
  if (input.isFounder !== undefined) user.isFounder = input.isFounder
  await user.save()

  return getUser(id)
}

export async function softDeleteUser(id: string, deletedBy: mongoose.Types.ObjectId): Promise<void> {
  const user = await User.findById(id)
  if (!user) throw new NotFoundError('User not found')

  if (String(user._id) === String(deletedBy)) {
    throw new AppError('Cannot delete your own account', 400, 'BAD_REQUEST')
  }

  user.deletedAt = new Date()
  await user.save()

  await UserRole.updateMany({ userId: user._id }, { isActive: false })
}
