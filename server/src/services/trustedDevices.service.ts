import crypto from 'crypto'
import mongoose from 'mongoose'
import { TrustedDevice } from '../models/TrustedDevice.js'
import { NotFoundError } from '../lib/errors.js'

const TRUST_DAYS = 30

export interface DeviceItem {
  id:        string
  label:     string
  lastIp:    string
  expiresAt: string
  createdAt: string
}

export function buildDeviceFingerprint(userAgent: string, ip: string): string {
  return crypto.createHash('sha256').update(`${userAgent}:${ip}`).digest('hex')
}

function buildLabel(userAgent: string): string {
  if (userAgent.includes('Chrome'))  return `Chrome — ${userAgent.includes('Mac') ? 'macOS' : 'Windows'}`
  if (userAgent.includes('Firefox')) return 'Firefox'
  if (userAgent.includes('Safari'))  return 'Safari'
  if (userAgent.includes('curl'))    return 'curl / API client'
  return userAgent.slice(0, 40)
}

export async function trustDevice(
  userId: mongoose.Types.ObjectId,
  userAgent: string,
  ip: string,
): Promise<DeviceItem> {
  const deviceHash = buildDeviceFingerprint(userAgent, ip)
  const expiresAt  = new Date(Date.now() + TRUST_DAYS * 24 * 60 * 60 * 1000)
  const label      = buildLabel(userAgent)

  const device = await TrustedDevice.findOneAndUpdate(
    { userId, deviceHash },
    { $set: { userAgent, lastIp: ip, label, expiresAt } },
    { upsert: true, new: true },
  )

  return {
    id:        String(device._id),
    label:     device.label,
    lastIp:    device.lastIp,
    expiresAt: device.expiresAt.toISOString(),
    createdAt: (device as any).createdAt?.toISOString() ?? '',
  }
}

export async function listDevices(userId: mongoose.Types.ObjectId): Promise<DeviceItem[]> {
  const devices = await TrustedDevice.find({ userId, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .lean()

  return devices.map((d) => ({
    id:        String(d._id),
    label:     d.label,
    lastIp:    d.lastIp,
    expiresAt: d.expiresAt.toISOString(),
    createdAt: (d as any).createdAt?.toISOString() ?? '',
  }))
}

export async function revokeDevice(userId: mongoose.Types.ObjectId, deviceId: string): Promise<void> {
  const result = await TrustedDevice.deleteOne({
    _id:    new mongoose.Types.ObjectId(deviceId),
    userId,
  })
  if (result.deletedCount === 0) throw new NotFoundError('Device not found')
}

export async function revokeAllDevices(userId: mongoose.Types.ObjectId): Promise<void> {
  await TrustedDevice.deleteMany({ userId })
}
