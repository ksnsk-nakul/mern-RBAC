import { Setting } from '../models/Setting.js'
import { NotFoundError } from '../lib/errors.js'
import mongoose from 'mongoose'

export interface SettingItem {
  id:       string
  group:    string
  name:     string
  slug:     string
  value:    unknown
  type:     string
  options:  string[]
  isPublic: boolean
}

export async function listSettings(publicOnly = false): Promise<Record<string, SettingItem[]>> {
  const filter = publicOnly ? { isPublic: true } : {}
  const settings = await Setting.find(filter).sort({ group: 1, name: 1 }).lean()

  const grouped: Record<string, SettingItem[]> = {}
  for (const s of settings) {
    const g = s.group
    if (!grouped[g]) grouped[g] = []
    grouped[g].push({
      id:       String(s._id),
      group:    s.group,
      name:     s.name,
      slug:     s.slug,
      value:    s.value,
      type:     s.type,
      options:  s.options ?? [],
      isPublic: s.isPublic,
    })
  }
  return grouped
}

export async function updateSetting(
  slug: string,
  value: unknown,
  updatedBy: mongoose.Types.ObjectId,
): Promise<SettingItem> {
  const setting = await Setting.findOne({ slug })
  if (!setting) throw new NotFoundError(`Setting "${slug}" not found`)

  setting.value     = value
  setting.updatedBy = updatedBy
  await setting.save()

  return {
    id:       String(setting._id),
    group:    setting.group,
    name:     setting.name,
    slug:     setting.slug,
    value:    setting.value,
    type:     setting.type,
    options:  setting.options ?? [],
    isPublic: setting.isPublic,
  }
}
