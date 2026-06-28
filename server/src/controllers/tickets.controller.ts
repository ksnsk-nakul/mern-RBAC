// server/src/controllers/tickets.controller.ts
import type { Request, Response } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { asyncHandler } from '../lib/errors.js'
import * as TicketsService from '../services/tickets.service.js'
import * as Notifications  from '../services/ticketNotifications.service.js'
import * as ActivityLogService from '../services/activityLog.service.js'

interface AuthUser { userId: mongoose.Types.ObjectId }
function auth(req: Request): AuthUser { return req.user as unknown as AuthUser }

const createSchema = z.object({
  subject: z.string().min(1).max(255),
  body:    z.string().min(1),
})

const messageSchema = z.object({
  body: z.string().min(1),
})

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = auth(req)
  const page  = Number(req.query.page)  || 1
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const result = await TicketsService.listMyTickets(userId, { page, limit })
  res.json(result)
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { subject, body } = createSchema.parse(req.body)
  const { userId } = auth(req)

  const ticket = await TicketsService.createTicket(
    { subject, body },
    userId,
    (req.files as Express.Multer.File[]) ?? [],
  )

  ActivityLogService.appendActivity({
    action: 'ticket.created', actorId: userId,
    targetType: 'ticket', targetId: ticket.id, targetName: ticket.subject,
  }).catch(() => {})

  res.status(201).json({ ticket })
})

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = auth(req)
  const ticket = await TicketsService.getUserTicket(req.params.id as string, userId)
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
  res.json({ ticket })
})

export const addMessage = asyncHandler(async (req: Request, res: Response) => {
  const { body } = messageSchema.parse(req.body)
  const { userId } = auth(req)

  const ticket = await TicketsService.getUserTicket(req.params.id as string, userId)
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

  const message = await TicketsService.addMessage(
    req.params.id as string, userId, { body, isInternal: false },
    (req.files as Express.Multer.File[]) ?? [],
  )

  Notifications.notifyNewMessage(ticket as any, userId, false).catch(() => {})
  ActivityLogService.appendActivity({
    action: 'ticket.message_added', actorId: userId,
    targetType: 'ticket', targetId: req.params.id as string,
  }).catch(() => {})

  res.status(201).json({ message })
})

export const getAttachment = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = auth(req)
  const { fileId } = req.params as { fileId: string }
  if (!mongoose.Types.ObjectId.isValid(fileId)) return res.status(404).json({ error: 'Not found' })

  const ticket = await TicketsService.getUserTicket(req.params.id as string, userId)
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

  const msg = ticket.messages.find((m) => m.id === req.params.msgId)
  if (!msg) return res.status(404).json({ error: 'Message not found' })

  const att = msg.attachments.find((a) => a.gridfsId === fileId)
  if (!att) return res.status(404).json({ error: 'Attachment not found' })

  await TicketsService.streamFromGridFS(new mongoose.Types.ObjectId(fileId), att.filename, att.contentType, res)
})
