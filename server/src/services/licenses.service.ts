import mongoose from 'mongoose'
import { License, type ILicense } from '../models/License.js'

export interface LicenseItem {
  id:        string
  userId:    string
  productId: string
  key:       string
  status:    string
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export interface VerifyResult {
  valid:      boolean
  userId?:    string
  productId?: string
  status?:    string
  expiresAt?: string | null
}

function toItem(l: ILicense): LicenseItem {
  return {
    id:        String(l._id),
    userId:    String(l.userId),
    productId: String(l.productId),
    key:       l.key,
    status:    l.status,
    expiresAt: l.expiresAt ? l.expiresAt.toISOString() : null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }
}

export async function createLicense(
  userId: mongoose.Types.ObjectId,
  productId: string,
): Promise<LicenseItem> {
  const license = await License.create({ userId, productId })
  return toItem(license)
}

export async function verifyLicense(key: string): Promise<VerifyResult> {
  const license = await License.findOne({ key }).lean()
  if (!license) return { valid: false }

  const now = new Date()
  const expired = license.expiresAt !== null && license.expiresAt < now
  const valid = license.status === 'active' && !expired

  return {
    valid,
    userId:    String(license.userId),
    productId: String(license.productId),
    status:    license.status,
    expiresAt: license.expiresAt ? license.expiresAt.toISOString() : null,
  }
}

export async function listLicenses(userId?: string): Promise<LicenseItem[]> {
  const filter: Record<string, unknown> = {}
  if (userId && mongoose.isValidObjectId(userId)) filter.userId = userId
  const licenses = await License.find(filter).sort({ createdAt: -1 }).lean()
  return licenses.map((l) => toItem(l as unknown as ILicense))
}
