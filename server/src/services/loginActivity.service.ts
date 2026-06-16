import { LoginActivityLog } from '../models/LoginActivityLog.js'

export interface RecordLoginInput {
  ip:          string
  userAgent:   string
  roleSlug:    string
  success:     boolean
  failReason?: string
}

export interface LoginActivityItem {
  id:          string
  ip:          string
  userAgent:   string
  roleSlug:    string
  success:     boolean
  failReason?: string
  createdAt:   string
}

export async function recordLogin(input: RecordLoginInput): Promise<void> {
  await LoginActivityLog.create(input)
}

export async function listLoginActivity(opts: {
  page?:    number
  limit?:   number
  from?:    Date
  to?:      Date
  success?: boolean
}): Promise<{ logs: LoginActivityItem[]; total: number; pages: number }> {
  const page  = opts.page  ?? 1
  const limit = opts.limit ?? 50
  const skip  = (page - 1) * limit

  const filter: Record<string, unknown> = {}
  if (opts.success !== undefined) filter.success = opts.success
  if (opts.from || opts.to) {
    const dateFilter: Record<string, Date> = {}
    if (opts.from) dateFilter.$gte = opts.from
    if (opts.to)   dateFilter.$lte = opts.to
    filter.createdAt = dateFilter
  }

  const [docs, total] = await Promise.all([
    LoginActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    LoginActivityLog.countDocuments(filter),
  ])

  return {
    logs: docs.map((d) => ({
      id:         String(d._id),
      ip:         d.ip,
      userAgent:  d.userAgent,
      roleSlug:   d.roleSlug,
      success:    d.success,
      failReason: d.failReason,
      createdAt:  (d as any).createdAt?.toISOString() ?? '',
    })),
    total,
    pages: Math.ceil(total / limit),
  }
}

export async function exportLoginLogs(opts: {
  from?:  Date
  to?:    Date
  limit?: number
}): Promise<LoginActivityItem[]> {
  const filter: Record<string, unknown> = {}
  if (opts.from || opts.to) {
    const dateFilter: Record<string, Date> = {}
    if (opts.from) dateFilter.$gte = opts.from
    if (opts.to)   dateFilter.$lte = opts.to
    filter.createdAt = dateFilter
  }

  const docs = await LoginActivityLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(opts.limit ?? 10_000, 10_000))
    .lean()

  return docs.map((d) => ({
    id:         String(d._id),
    ip:         d.ip,
    userAgent:  d.userAgent,
    roleSlug:   d.roleSlug,
    success:    d.success,
    failReason: d.failReason,
    createdAt:  (d as any).createdAt?.toISOString() ?? '',
  }))
}
