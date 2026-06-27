// server/src/controllers/admin/tickets.controller.ts
import type { Request, Response } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { asyncHandler, ForbiddenError } from '../../lib/errors.js'
import * as TicketsService from '../../services/tickets.service.js'
import * as Notifications  from '../../services/ticketNotifications.service.js'
import * as ActivityLogService from '../../services/activityLog.service.js'
import { SupportTicket } from '../../models/SupportTicket.js'

interface AuthUser { userId: mongoose.Types.ObjectId; permissions: string[] }

function auth(req: Request): AuthUser { return req.user as unknown as AuthUser }
function canManage(req: Request): boolean {
  const { permissions } = auth(req)
  return permissions.includes('*') || permissions.includes('tickets.manage')
}

const createSchema = z.object({
  subject:     z.string().min(1).max(255),
  body:        z.string().min(1),
  requestedBy: z.string().regex(/^[a-f\d]{24}$/i),
})

const updateSchema = z.object({
  status:     z.enum(['open', 'in_progress', 'waiting_for_user', 'resolved', 'closed']).optional(),
  priority:   z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignedTo: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(),
})

const messageSchema = z.object({
  body:       z.string().min(1),
  isInternal: z.boolean().optional().default(false),
})

export const list = asyncHandler(async (req: Request, res: Response) => {
  const status     = req.query.status     as string | undefined
  const priority   = req.query.priority   as string | undefined
  const assignedTo = req.query.assignedTo as string | undefined
  const page       = Number(req.query.page)  || 1
  const limit      = Math.min(Number(req.query.limit) || 20, 100)

  const result = await TicketsService.listAdminTickets({ status: status as any, priority: priority as any, assignedTo, page, limit })
  res.json(result)
})

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await TicketsService.getAdminTicket(req.params.id as string)
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
  res.json({ ticket })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!canManage(req)) throw new ForbiddenError('Missing permission: tickets.manage')
  const { subject, body, requestedBy } = createSchema.parse(req.body)
  const a = auth(req)

  const ticket = await TicketsService.createTicket(
    { subject, body },
    new mongoose.Types.ObjectId(requestedBy),
    (req.files as Express.Multer.File[]) ?? [],
  )

  ActivityLogService.appendActivity({
    action: 'ticket.created', actorId: a.userId,
    targetType: 'ticket', targetId: ticket.id, targetName: ticket.subject,
  }).catch(() => {})

  res.status(201).json({ ticket })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!canManage(req)) throw new ForbiddenError('Missing permission: tickets.manage')
  const input = updateSchema.parse(req.body)
  const a = auth(req)

  const prevTicket = await SupportTicket.findById(req.params.id as string).lean()
  const ticket = await TicketsService.updateTicketMeta(req.params.id as string, input)

  if (input.status && prevTicket && (prevTicket as any).status !== input.status) {
    Notifications.notifyStatusChange(prevTicket as any, input.status).catch(() => {})
    ActivityLogService.appendActivity({
      action: 'ticket.status_changed', actorId: a.userId,
      targetType: 'ticket', targetId: ticket.id,
      meta: { from: (prevTicket as any).status, to: input.status },
    }).catch(() => {})
  }

  if (input.assignedTo && prevTicket && String((prevTicket as any).assignedTo) !== input.assignedTo) {
    Notifications.notifyAssignment(prevTicket as any, new mongoose.Types.ObjectId(input.assignedTo)).catch(() => {})
    ActivityLogService.appendActivity({
      action: 'ticket.assigned', actorId: a.userId,
      targetType: 'ticket', targetId: ticket.id,
      meta: { assignedTo: input.assignedTo },
    }).catch(() => {})
  }

  res.json({ ticket })
})

export const addMessage = asyncHandler(async (req: Request, res: Response) => {
  const raw = messageSchema.parse(req.body)
  const a = auth(req)

  const isInternal = raw.isInternal && canManage(req)

  const ticket = await TicketsService.getAdminTicket(req.params.id as string)
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

  const message = await TicketsService.addMessage(
    req.params.id as string, a.userId, { body: raw.body, isInternal },
    (req.files as Express.Multer.File[]) ?? [],
  )

  Notifications.notifyNewMessage(ticket as any, a.userId, isInternal).catch(() => {})
  ActivityLogService.appendActivity({
    action: 'ticket.message_added', actorId: a.userId,
    targetType: 'ticket', targetId: req.params.id as string,
  }).catch(() => {})

  res.status(201).json({ message })
})

export const getAttachment = asyncHandler(async (req: Request, res: Response) => {
  const { fileId } = req.params as { fileId: string }
  if (!mongoose.Types.ObjectId.isValid(fileId)) return res.status(404).json({ error: 'Not found' })

  const ticket = await TicketsService.getAdminTicket(req.params.id as string)
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

  const msg = ticket.messages.find((m) => m.id === req.params.msgId)
  if (!msg) return res.status(404).json({ error: 'Message not found' })

  const att = msg.attachments.find((a) => a.gridfsId === fileId)
  if (!att) return res.status(404).json({ error: 'Attachment not found' })

  await TicketsService.streamFromGridFS(new mongoose.Types.ObjectId(fileId), att.filename, att.contentType, res)
})
