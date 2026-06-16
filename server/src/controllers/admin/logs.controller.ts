import type { Request, Response } from 'express'
import { asyncHandler } from '../../lib/errors.js'
import * as ActivityLogService from '../../services/activityLog.service.js'
import * as LoginActivityService from '../../services/loginActivity.service.js'

function parseDateParam(val: unknown): Date | undefined {
  if (typeof val !== 'string' || !val) return undefined
  const d = new Date(val)
  return isNaN(d.getTime()) ? undefined : d
}

function toCSV(headers: string[], rows: Record<string, unknown>[]): string {
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const header = headers.join(',')
  const body   = rows.map((r) => headers.map((h) => escape(r[h])).join(',')).join('\n')
  return `${header}\n${body}`
}

export const listActivity = asyncHandler(async (req: Request, res: Response) => {
  const page   = Number(req.query.page)   || 1
  const limit  = Number(req.query.limit)  || 50
  const from   = parseDateParam(req.query.from)
  const to     = parseDateParam(req.query.to)
  const action = (req.query.action as string) || undefined

  const result = await ActivityLogService.listActivity({ page, limit, from, to, action })
  res.json(result)
})

export const listLogin = asyncHandler(async (req: Request, res: Response) => {
  const page    = Number(req.query.page)  || 1
  const limit   = Number(req.query.limit) || 50
  const from    = parseDateParam(req.query.from)
  const to      = parseDateParam(req.query.to)
  const success = req.query.success === 'true'  ? true
                : req.query.success === 'false' ? false
                : undefined

  const result = await LoginActivityService.listLoginActivity({ page, limit, from, to, success })
  res.json(result)
})

export const exportLogs = asyncHandler(async (req: Request, res: Response) => {
  const type   = (req.query.type as string) === 'login' ? 'login' : 'activity'
  const format = (req.query.format as string) === 'csv'  ? 'csv'  : 'json'
  const from   = parseDateParam(req.query.from)
  const to     = parseDateParam(req.query.to)

  if (type === 'login') {
    const rows = await LoginActivityService.exportLoginLogs({ from, to })

    if (format === 'csv') {
      const headers = ['id', 'ip', 'userAgent', 'roleSlug', 'success', 'failReason', 'createdAt']
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename="login-logs.csv"')
      res.send(toCSV(headers, rows as unknown as Record<string, unknown>[]))
      return
    }
    res.json({ logs: rows })
    return
  }

  const rows = await ActivityLogService.exportLogs({ from, to })

  if (format === 'csv') {
    const headers = ['id', 'action', 'actorEmail', 'targetType', 'targetId', 'targetName', 'hash', 'prevHash', 'createdAt']
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="activity-logs.csv"')
    res.send(toCSV(headers, rows as unknown as Record<string, unknown>[]))
    return
  }
  res.json({ logs: rows })
})

export const chainIntegrity = asyncHandler(async (_req: Request, res: Response) => {
  const result = await ActivityLogService.verifyChain()
  res.json(result)
})
