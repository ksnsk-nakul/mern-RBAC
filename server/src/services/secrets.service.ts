import mongoose from 'mongoose'
import { Secret } from '../models/Secret.js'
import { Permission } from '../models/Permission.js'
import { NotFoundError } from '../lib/errors.js'
import { encrypt, decrypt } from '../lib/crypto.js'

export interface SecretListItem {
  id:        string
  group:     string
  name:      string
  slug:      string
  isSet:     boolean
  updatedAt: string | null
}

export async function listSecrets(): Promise<Record<string, SecretListItem[]>> {
  const secrets = await Secret.find().sort({ group: 1, name: 1 }).lean()
  const grouped: Record<string, SecretListItem[]> = {}

  for (const s of secrets) {
    if (!grouped[s.group]) grouped[s.group] = []
    grouped[s.group].push({
      id:        String(s._id),
      group:     s.group,
      name:      s.name,
      slug:      s.slug,
      isSet:     s.isSet,
      updatedAt: (s as any).updatedAt?.toISOString?.() ?? null,
    })
  }
  return grouped
}

export async function revealSecret(slug: string): Promise<string> {
  const secret = await Secret.findOne({ slug })
  if (!secret) throw new NotFoundError(`Secret "${slug}" not found`)
  if (!secret.isSet || !secret.encryptedValue || !secret.iv || !secret.authTag) {
    throw new NotFoundError('Secret has no value set')
  }

  return decrypt({
    encryptedValue: secret.encryptedValue,
    iv:             secret.iv,
    authTag:        secret.authTag,
  })
}

export async function setSecret(
  slug: string,
  value: string,
  updatedBy: mongoose.Types.ObjectId,
): Promise<SecretListItem> {
  const secret = await Secret.findOne({ slug })
  if (!secret) throw new NotFoundError(`Secret "${slug}" not found`)

  const payload = encrypt(value)
  secret.encryptedValue = payload.encryptedValue
  secret.iv             = payload.iv
  secret.authTag        = payload.authTag
  secret.isSet          = true
  secret.updatedBy      = updatedBy
  await secret.save()

  return {
    id:        String(secret._id),
    group:     secret.group,
    name:      secret.name,
    slug:      secret.slug,
    isSet:     true,
    updatedAt: new Date().toISOString(),
  }
}

export async function clearSecret(
  slug: string,
  updatedBy: mongoose.Types.ObjectId,
): Promise<SecretListItem> {
  const secret = await Secret.findOne({ slug })
  if (!secret) throw new NotFoundError(`Secret "${slug}" not found`)

  secret.encryptedValue = undefined
  secret.iv             = undefined
  secret.authTag        = undefined
  secret.isSet          = false
  secret.updatedBy      = updatedBy
  await secret.save()

  return {
    id:        String(secret._id),
    group:     secret.group,
    name:      secret.name,
    slug:      secret.slug,
    isSet:     false,
    updatedAt: new Date().toISOString(),
  }
}

export async function ensureSecretPermissions(group: string): Promise<void> {
  const slugs = [
    { slug: `secrets.${group}.view`,   name: `View ${group} Secrets`,   mainGroup: 'Secrets' },
    { slug: `secrets.${group}.manage`, name: `Manage ${group} Secrets`, mainGroup: 'Secrets' },
  ]
  for (const p of slugs) {
    await Permission.findOneAndUpdate(
      { slug: p.slug },
      { $setOnInsert: { ...p, isProtected: false } },
      { upsert: true },
    )
  }
}
