import crypto from 'crypto'
import mongoose from 'mongoose'
import { ActivityLog } from '../models/ActivityLog.js'

export interface AppendInput {
  action:      string
  actorId?:    mongoose.Types.ObjectId
  actorEmail?: string
  targetType?: string
  targetId?:   string
  targetName?: string
  meta?:       Record<string, unknown>
}

export interface ActivityLogItem {
  id:          string
  action:      string
  actorEmail?: string
  targetType?: string
  targetId?:   string
  targetName?: string
  meta?:       Record<string, unknown>
  hash:        string
  prevHash:    string
  createdAt:   string
}

function computeHash(content: object): string {
  return crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex')
}

function compact<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>
}

export async function appendActivity(input: AppendInput): Promise<void> {
  const last     = await ActivityLog.findOne().sort({ createdAt: -1 }).lean()
  const prevHash = last?.hash ?? 'genesis'
  const content  = compact({ ...input, prevHash })
  const hash     = computeHash(content)
  await ActivityLog.create({ ...content, hash })
}

export async function listActivity(opts: {
  page?:   number
  limit?:  number
  from?:   Date
  to?:     Date
  action?: string
}): Promise<{ logs: ActivityLogItem[]; total: number; pages: number }> {
  const page  = opts.page  ?? 1
  const limit = opts.limit ?? 50
  const skip  = (page - 1) * limit

  const filter: Record<string, unknown> = {}
  if (opts.action) filter.action = opts.action
  if (opts.from || opts.to) {
    const dateFilter: Record<string, Date> = {}
    if (opts.from) dateFilter.$gte = opts.from
    if (opts.to)   dateFilter.$lte = opts.to
    filter.createdAt = dateFilter
  }

  const [docs, total] = await Promise.all([
    ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ActivityLog.countDocuments(filter),
  ])

  return {
    logs: docs.map((d) => ({
      id:         String(d._id),
      action:     d.action,
      actorEmail: d.actorEmail,
      targetType: d.targetType,
      targetId:   d.targetId,
      targetName: d.targetName,
      meta:       d.meta as Record<string, unknown> | undefined,
      hash:       d.hash,
      prevHash:   d.prevHash,
      createdAt:  (d as any).createdAt?.toISOString() ?? '',
    })),
    total,
    pages: Math.ceil(total / limit),
  }
}

export async function verifyChain(): Promise<{ valid: boolean; brokenAt?: number }> {
  const records = await ActivityLog.find().sort({ createdAt: 1 }).lean()
  if (records.length === 0) return { valid: true }

  for (let i = 0; i < records.length; i++) {
    const rec      = records[i]!
    const prevHash = i === 0 ? 'genesis' : records[i - 1]!.hash
    const content  = compact({
      action:     rec.action,
      actorId:    rec.actorId,
      actorEmail: rec.actorEmail,
      targetType: rec.targetType,
      targetId:   rec.targetId,
      targetName: rec.targetName,
      meta:       rec.meta,
      prevHash,
    })
    const expected = computeHash(content)
    if (rec.hash !== expected || rec.prevHash !== prevHash) {
      return { valid: false, brokenAt: i }
    }
  }

  return { valid: true }
}

export async function exportLogs(opts: {
  from?:  Date
  to?:    Date
  limit?: number
}): Promise<ActivityLogItem[]> {
  const filter: Record<string, unknown> = {}
  if (opts.from || opts.to) {
    const dateFilter: Record<string, Date> = {}
    if (opts.from) dateFilter.$gte = opts.from
    if (opts.to)   dateFilter.$lte = opts.to
    filter.createdAt = dateFilter
  }

  const docs = await ActivityLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(opts.limit ?? 10_000)
    .lean()

  return docs.map((d) => ({
    id:         String(d._id),
    action:     d.action,
    actorEmail: d.actorEmail,
    targetType: d.targetType,
    targetId:   d.targetId,
    targetName: d.targetName,
    meta:       d.meta as Record<string, unknown> | undefined,
    hash:       d.hash,
    prevHash:   d.prevHash,
    createdAt:  (d as any).createdAt?.toISOString() ?? '',
  }))
}
