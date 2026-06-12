import mongoose from 'mongoose'
import { LoginConfig } from '../models/LoginConfig.js'
import { Role } from '../models/Role.js'
import { NotFoundError } from '../lib/errors.js'

export interface LoginConfigItem {
  id:                string | null
  roleId:            string
  roleName:          string
  roleSlug:          string
  template:          'modal' | 'centered' | 'split'
  bgImage:           string | null
  logoUrl:           string | null
  brandTitle:        string
  brandSubtitle:     string | null
  googleAuthEnabled: boolean
}

export async function listLoginConfigs(): Promise<LoginConfigItem[]> {
  const roles   = await Role.find().lean()
  const configs = await LoginConfig.find().lean()
  const configMap = new Map(configs.map((c) => [String(c.roleId), c]))

  return roles.map((r) => {
    const cfg = configMap.get(String(r._id))
    return {
      id:                cfg ? String(cfg._id) : null,
      roleId:            String(r._id),
      roleName:          r.name,
      roleSlug:          r.slug,
      template:          cfg?.template          ?? 'centered',
      bgImage:           cfg?.bgImage           ?? null,
      logoUrl:           cfg?.logoUrl           ?? null,
      brandTitle:        cfg?.brandTitle        ?? 'Sign in',
      brandSubtitle:     cfg?.brandSubtitle     ?? null,
      googleAuthEnabled: cfg?.googleAuthEnabled ?? false,
    }
  })
}

export async function upsertLoginConfig(
  roleId: string,
  input: {
    template:          'modal' | 'centered' | 'split'
    bgImage?:          string | null
    logoUrl?:          string | null
    brandTitle?:       string
    brandSubtitle?:    string | null
    googleAuthEnabled?: boolean
  },
  updatedBy: mongoose.Types.ObjectId,
): Promise<LoginConfigItem> {
  const role = await Role.findById(roleId)
  if (!role) throw new NotFoundError('Role not found')

  await LoginConfig.findOneAndUpdate(
    { roleId },
    {
      $set: {
        template:          input.template,
        bgImage:           input.bgImage   ?? null,
        logoUrl:           input.logoUrl   ?? null,
        brandTitle:        input.brandTitle    ?? 'Sign in',
        brandSubtitle:     input.brandSubtitle ?? null,
        googleAuthEnabled: input.googleAuthEnabled ?? false,
        updatedBy,
      },
    },
    { upsert: true, new: true },
  )

  const updated = await LoginConfig.findOne({ roleId }).lean()
  return {
    id:                updated ? String(updated._id) : null,
    roleId:            String(role._id),
    roleName:          role.name,
    roleSlug:          role.slug,
    template:          updated?.template          ?? 'centered',
    bgImage:           updated?.bgImage           ?? null,
    logoUrl:           updated?.logoUrl           ?? null,
    brandTitle:        updated?.brandTitle        ?? 'Sign in',
    brandSubtitle:     updated?.brandSubtitle     ?? null,
    googleAuthEnabled: updated?.googleAuthEnabled ?? false,
  }
}
