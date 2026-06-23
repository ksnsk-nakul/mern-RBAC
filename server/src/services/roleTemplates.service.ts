import mongoose from 'mongoose'
import { RoleTemplate } from '../models/RoleTemplate.js'
import { NotFoundError } from '../lib/errors.js'

export interface RoleTemplateItem {
  id:            string
  name:          string
  description?:  string
  permissionIds: string[]
  createdAt:     string
}

interface RoleTemplateLean {
  _id:            mongoose.Types.ObjectId
  name:           string
  description?:   string
  permissionIds:  mongoose.Types.ObjectId[]
  createdAt:      Date
}

function toItem(t: RoleTemplateLean): RoleTemplateItem {
  return {
    id:            String(t._id),
    name:          t.name,
    description:   t.description,
    permissionIds: t.permissionIds.map((id) => String(id)),
    createdAt:     t.createdAt?.toISOString() ?? '',
  }
}

export interface CreateTemplateInput {
  name:          string
  description?:  string
  permissionIds: string[]
}

export async function createTemplate(input: CreateTemplateInput, actorId: mongoose.Types.ObjectId): Promise<RoleTemplateItem> {
  const template = await RoleTemplate.create({
    name:          input.name,
    description:   input.description,
    permissionIds: input.permissionIds,
    createdBy:     actorId,
  })
  return toItem(template as unknown as RoleTemplateLean)
}

export async function listTemplates(): Promise<RoleTemplateItem[]> {
  const templates = await RoleTemplate.find().sort({ name: 1 }).lean()
  return (templates as unknown as RoleTemplateLean[]).map(toItem)
}

export async function deleteTemplate(id: string): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError('Role template not found')
  const result = await RoleTemplate.deleteOne({ _id: id })
  if (result.deletedCount === 0) throw new NotFoundError('Role template not found')
}
