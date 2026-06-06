import mongoose from 'mongoose'
import { Role, type IRole } from '../models/Role.js'
import { Permission } from '../models/Permission.js'
import { UserRole } from '../models/UserRole.js'
import { NotFoundError, AppError } from '../lib/errors.js'
import { z } from 'zod'

export const createRoleSchema = z.object({
  name:               z.string().min(1).max(80),
  slug:               z.string().regex(/^[a-z0-9_]+$/, 'slug must be lowercase alphanumeric/underscore'),
  route:              z.string().min(1),
  color:              z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
  isSubAdmin:         z.boolean().default(false),
  mfaRequired:        z.boolean().default(false),
  requireIpAllowlist: z.boolean().default(false),
  permissionIds:      z.array(z.string()).default([]),
})

export const updateRoleSchema = createRoleSchema.partial().omit({ slug: true })

export type CreateRoleInput = z.infer<typeof createRoleSchema>
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>

export interface RoleDetail {
  id:                 string
  name:               string
  slug:               string
  route:              string
  color:              string
  isSubAdmin:         boolean
  isDefault:          boolean
  isProtected:        boolean
  mfaRequired:        boolean
  requireIpAllowlist: boolean
  permissions:        Array<{ id: string; slug: string; name: string; mainGroup: string }>
  userCount:          number
}

export async function listRoles(): Promise<RoleDetail[]> {
  const roles = await Role.find()
    .populate<{ permissions: Array<{ _id: mongoose.Types.ObjectId; slug: string; name: string; mainGroup: string }> }>(
      'permissions', 'slug name mainGroup',
    )
    .lean()

  const roleIds = roles.map((r) => r._id)
  const counts  = await UserRole.aggregate([
    { $match: { roleId: { $in: roleIds }, isActive: true } },
    { $group: { _id: '$roleId', count: { $sum: 1 } } },
  ])
  const countMap = new Map<string, number>(counts.map((c) => [String(c._id), c.count]))

  return roles.map((r) => ({
    id:                 String(r._id),
    name:               r.name,
    slug:               r.slug,
    route:              r.route,
    color:              r.color,
    isSubAdmin:         r.isSubAdmin,
    isDefault:          r.isDefault,
    isProtected:        r.isProtected,
    mfaRequired:        r.mfaRequired,
    requireIpAllowlist: r.requireIpAllowlist,
    permissions:        (r.permissions as any[]).map((p: any) => ({
      id:        String(p._id),
      slug:      p.slug,
      name:      p.name,
      mainGroup: p.mainGroup,
    })),
    userCount: countMap.get(String(r._id)) ?? 0,
  }))
}

export async function getRole(id: string): Promise<RoleDetail> {
  const roles = await listRoles()
  const role  = roles.find((r) => r.id === id)
  if (!role) throw new NotFoundError('Role not found')
  return role
}

export async function createRole(input: CreateRoleInput): Promise<RoleDetail> {
  const exists = await Role.findOne({ slug: input.slug })
  if (exists) throw new AppError('Role slug already in use', 409, 'CONFLICT')

  const permissions = await Permission.find({ _id: { $in: input.permissionIds } })
  const role        = await Role.create({
    name:               input.name,
    slug:               input.slug,
    route:              input.route,
    color:              input.color,
    isSubAdmin:         input.isSubAdmin,
    isDefault:          false,
    isProtected:        false,
    mfaRequired:        input.mfaRequired,
    requireIpAllowlist: input.requireIpAllowlist,
    permissions:        permissions.map((p) => p._id),
  })

  return getRole(String(role._id))
}

export async function updateRole(id: string, input: UpdateRoleInput): Promise<RoleDetail> {
  const role = await Role.findById(id)
  if (!role) throw new NotFoundError('Role not found')

  if (input.name               !== undefined) role.name               = input.name
  if (input.route              !== undefined) role.route              = input.route
  if (input.color              !== undefined) role.color              = input.color
  if (input.isSubAdmin         !== undefined) role.isSubAdmin         = input.isSubAdmin
  if (input.mfaRequired        !== undefined) role.mfaRequired        = input.mfaRequired
  if (input.requireIpAllowlist !== undefined) role.requireIpAllowlist = input.requireIpAllowlist

  if (input.permissionIds !== undefined) {
    const perms      = await Permission.find({ _id: { $in: input.permissionIds } })
    role.permissions = perms.map((p) => p._id as mongoose.Types.ObjectId)
  }

  await role.save()
  return getRole(id)
}

export async function deleteRole(id: string): Promise<void> {
  const role = await Role.findById(id)
  if (!role) throw new NotFoundError('Role not found')
  if (role.isProtected) throw new AppError('Protected roles cannot be deleted', 400, 'BAD_REQUEST')

  await UserRole.updateMany({ roleId: role._id }, { isActive: false })
  await role.deleteOne()
}

export async function setRolePermissions(id: string, permissionIds: string[]): Promise<RoleDetail> {
  const role = await Role.findById(id)
  if (!role) throw new NotFoundError('Role not found')

  const perms      = await Permission.find({ _id: { $in: permissionIds } })
  role.permissions = perms.map((p) => p._id as mongoose.Types.ObjectId)
  await role.save()

  return getRole(id)
}
