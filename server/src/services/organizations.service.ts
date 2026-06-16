import crypto from 'crypto'
import mongoose from 'mongoose'
import { Organization } from '../models/Organization.js'
import { OrganizationUser, type OrgRole } from '../models/OrganizationUser.js'
import { User } from '../models/User.js'
import { AppError, NotFoundError } from '../lib/errors.js'

export interface OrgItem {
  id:        string
  name:      string
  slug:      string
  createdAt: string
}

export interface OrgMemberItem {
  userId:    string
  orgId:     string
  orgRole:   OrgRole
  status:    string
  createdAt: string
}

export interface OrgWithRoleItem extends OrgItem {
  orgRole: OrgRole
  status:  string
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function createOrg(
  input: { name: string; slug?: string },
  actorId: mongoose.Types.ObjectId,
): Promise<OrgItem> {
  const slug = input.slug ? input.slug.toLowerCase() : toSlug(input.name)

  const existing = await Organization.findOne({ slug })
  if (existing) throw new AppError(`Organization slug '${slug}' is already taken`, 409)

  const org = await Organization.create({ name: input.name, slug, createdBy: actorId })

  // Creator automatically becomes owner
  await OrganizationUser.create({ orgId: org._id, userId: actorId, orgRole: 'owner', status: 'active' })

  return { id: String(org._id), name: org.name, slug: org.slug, createdAt: (org as any).createdAt?.toISOString() ?? '' }
}

export async function getOrg(id: string): Promise<OrgItem> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError('Organization not found')
  const org = await Organization.findById(id).lean()
  if (!org) throw new NotFoundError('Organization not found')
  return { id: String(org._id), name: org.name, slug: org.slug, createdAt: (org as any).createdAt?.toISOString() ?? '' }
}

export async function listOrgs(opts: {
  page?:   number
  limit?:  number
  search?: string
}): Promise<{ orgs: OrgItem[]; total: number; pages: number }> {
  const page  = opts.page  ?? 1
  const limit = opts.limit ?? 20
  const skip  = (page - 1) * limit

  const filter: Record<string, unknown> = {}
  if (opts.search) filter.name = { $regex: opts.search, $options: 'i' }

  const [orgs, total] = await Promise.all([
    Organization.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Organization.countDocuments(filter),
  ])

  return {
    orgs: orgs.map((o) => ({
      id:        String(o._id),
      name:      o.name,
      slug:      o.slug,
      createdAt: (o as any).createdAt?.toISOString() ?? '',
    })),
    total,
    pages: Math.ceil(total / limit),
  }
}

export async function updateOrg(
  id: string,
  input: { name?: string; slug?: string },
): Promise<OrgItem> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError('Organization not found')

  if (input.slug) {
    const existing = await Organization.findOne({ slug: input.slug, _id: { $ne: new mongoose.Types.ObjectId(id) } })
    if (existing) throw new AppError(`Slug '${input.slug}' is already taken`, 409)
  }

  const update: Record<string, string> = {}
  if (input.name) update.name = input.name
  if (input.slug) update.slug = input.slug.toLowerCase()

  const org = await Organization.findByIdAndUpdate(id, { $set: update }, { new: true }).lean()
  if (!org) throw new NotFoundError('Organization not found')

  return { id: String(org._id), name: org.name, slug: org.slug, createdAt: (org as any).createdAt?.toISOString() ?? '' }
}

export async function deleteOrg(id: string): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError('Organization not found')
  const oid = new mongoose.Types.ObjectId(id)
  const org = await Organization.findById(oid)
  if (!org) throw new NotFoundError('Organization not found')

  await Promise.all([
    OrganizationUser.deleteMany({ orgId: oid }),
    User.updateMany({ currentOrganization: oid }, { $unset: { currentOrganization: '' } }),
    org.deleteOne(),
  ])
}

export async function inviteMember(
  orgId:     mongoose.Types.ObjectId,
  userId:    mongoose.Types.ObjectId,
  orgRole:   OrgRole,
  invitedBy: mongoose.Types.ObjectId,
): Promise<{ invitationToken: string }> {
  const existing = await OrganizationUser.findOne({ orgId, userId })
  if (existing) throw new AppError('User is already a member or has a pending invite', 409)

  const rawToken        = crypto.randomBytes(32).toString('hex')
  const invitationToken = crypto.createHash('sha256').update(rawToken).digest('hex')

  await OrganizationUser.create({ orgId, userId, orgRole, status: 'pending', invitationToken, invitedBy })

  return { invitationToken: rawToken }
}

export async function acceptInvite(
  rawToken: string,
  userId:   mongoose.Types.ObjectId,
): Promise<OrgMemberItem> {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

  const membership = await OrganizationUser.findOneAndUpdate(
    { invitationToken: tokenHash, status: 'pending', userId },
    { $set: { status: 'active' }, $unset: { invitationToken: '' } },
    { new: true },
  )

  if (!membership) throw new NotFoundError('Invitation not found or already used')

  return {
    userId:    String(membership.userId),
    orgId:     String(membership.orgId),
    orgRole:   membership.orgRole,
    status:    membership.status,
    createdAt: (membership as any).createdAt?.toISOString() ?? '',
  }
}

export async function addMember(
  orgId:   mongoose.Types.ObjectId,
  userId:  mongoose.Types.ObjectId,
  orgRole: OrgRole,
): Promise<OrgMemberItem> {
  const existing = await OrganizationUser.findOne({ orgId, userId })
  if (existing) throw new AppError('User is already a member', 409)

  const membership = await OrganizationUser.create({ orgId, userId, orgRole, status: 'active' })

  return {
    userId:    String(membership.userId),
    orgId:     String(membership.orgId),
    orgRole:   membership.orgRole,
    status:    membership.status,
    createdAt: (membership as any).createdAt?.toISOString() ?? '',
  }
}

export async function removeMember(
  orgId:  mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
): Promise<void> {
  const membership = await OrganizationUser.findOne({ orgId, userId })
  if (!membership) throw new NotFoundError('Member not found')

  if (membership.orgRole === 'owner') {
    const otherOwners = await OrganizationUser.find({ orgId, orgRole: 'owner', userId: { $ne: userId } }).lean()
    if (otherOwners.length === 0) throw new AppError('Cannot remove the last owner of an organization', 409)
  }

  await OrganizationUser.deleteOne({ orgId, userId })
}

export async function listMembers(orgId: mongoose.Types.ObjectId): Promise<OrgMemberItem[]> {
  const members = await OrganizationUser.find({ orgId }).lean()
  return members.map((m) => ({
    userId:    String(m.userId),
    orgId:     String(m.orgId),
    orgRole:   m.orgRole,
    status:    m.status,
    createdAt: (m as any).createdAt?.toISOString() ?? '',
  }))
}

export async function switchOrg(
  userId: mongoose.Types.ObjectId,
  orgId:  mongoose.Types.ObjectId | null,
): Promise<void> {
  if (orgId) {
    await User.updateOne({ _id: userId }, { $set: { currentOrganization: orgId } })
  } else {
    await User.updateOne({ _id: userId }, { $unset: { currentOrganization: '' } })
  }
}

export async function listMyOrgs(userId: mongoose.Types.ObjectId): Promise<OrgWithRoleItem[]> {
  const memberships = await OrganizationUser.find({ userId, status: 'active' })
    .populate<{ orgId: { _id: mongoose.Types.ObjectId; name: string; slug: string; createdAt: Date } }>('orgId', 'name slug createdAt')
    .lean()

  return memberships.map((m) => {
    const org = m.orgId as any
    return {
      id:        String(org._id),
      name:      org.name,
      slug:      org.slug,
      createdAt: org.createdAt?.toISOString() ?? '',
      orgRole:   m.orgRole,
      status:    m.status,
    }
  })
}
