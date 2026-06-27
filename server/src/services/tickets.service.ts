// server/src/services/tickets.service.ts
import mongoose from 'mongoose'
import { SupportTicket, type TicketStatus, type TicketPriority } from '../models/SupportTicket.js'
import { TicketMessage } from '../models/TicketMessage.js'
import { NotFoundError, ForbiddenError } from '../lib/errors.js'
import { uploadToGridFS, streamFromGridFS } from '../lib/gridfs.js'
import type { Response } from 'express'

// ── Item shapes ──────────────────────────────────────────────────────────────

export interface AttachmentItem {
  filename:    string
  contentType: string
  size:        number
  gridfsId:    string
}

export interface MessageItem {
  id:          string
  userId:      string
  body:        string
  isInternal:  boolean
  attachments: AttachmentItem[]
  createdAt:   string
}

export interface TicketItem {
  id:          string
  subject:     string
  status:      TicketStatus
  priority:    TicketPriority
  requestedBy: string
  orgId?:      string
  assignedTo?: string
  createdAt:   string
  updatedAt:   string
}

export interface TicketWithMessages extends TicketItem {
  messages: MessageItem[]
}

// ── Lean types ───────────────────────────────────────────────────────────────

interface TicketLean {
  _id:         mongoose.Types.ObjectId
  subject:     string
  status:      TicketStatus
  priority:    TicketPriority
  requestedBy: mongoose.Types.ObjectId
  orgId?:      mongoose.Types.ObjectId
  assignedTo?: mongoose.Types.ObjectId
  createdAt:   Date
  updatedAt:   Date
}

interface MessageLean {
  _id:        mongoose.Types.ObjectId
  ticketId:   mongoose.Types.ObjectId
  userId:     mongoose.Types.ObjectId
  body:       string
  isInternal: boolean
  attachments: { filename: string; contentType: string; size: number; gridfsId: mongoose.Types.ObjectId }[]
  createdAt:  Date
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function toTicketItem(t: TicketLean): TicketItem {
  return {
    id:          String(t._id),
    subject:     t.subject,
    status:      t.status,
    priority:    t.priority,
    requestedBy: String(t.requestedBy),
    orgId:       t.orgId ? String(t.orgId) : undefined,
    assignedTo:  t.assignedTo ? String(t.assignedTo) : undefined,
    createdAt:   t.createdAt?.toISOString() ?? '',
    updatedAt:   t.updatedAt?.toISOString() ?? '',
  }
}

function toMessageItem(m: MessageLean): MessageItem {
  return {
    id:         String(m._id),
    userId:     String(m.userId),
    body:       m.body,
    isInternal: m.isInternal,
    attachments: m.attachments.map((a) => ({
      filename:    a.filename,
      contentType: a.contentType,
      size:        a.size,
      gridfsId:    String(a.gridfsId),
    })),
    createdAt: m.createdAt?.toISOString() ?? '',
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function saveFiles(files: Express.Multer.File[]): Promise<MessageLean['attachments']> {
  const attachments: MessageLean['attachments'] = []
  for (const file of files) {
    const gridfsId = await uploadToGridFS(file.buffer, file.originalname, file.mimetype)
    attachments.push({ filename: file.originalname, contentType: file.mimetype, size: file.size, gridfsId })
  }
  return attachments
}

// ── Service functions ─────────────────────────────────────────────────────────

export interface CreateTicketInput {
  subject: string
  body:    string
  orgId?:  string
}

export async function createTicket(
  input:       CreateTicketInput,
  requestedBy: mongoose.Types.ObjectId,
  files:       Express.Multer.File[] = [],
): Promise<TicketItem> {
  const ticket = await SupportTicket.create({
    subject:     input.subject,
    requestedBy,
    orgId:       input.orgId,
    status:      'open',
    priority:    'medium',
  })

  const attachments = await saveFiles(files)

  await TicketMessage.create({
    ticketId:   ticket._id,
    userId:     requestedBy,
    body:       input.body,
    isInternal: false,
    attachments,
  })

  return toTicketItem(ticket as unknown as TicketLean)
}

export interface ListAdminFilter {
  status?:     TicketStatus
  priority?:   TicketPriority
  assignedTo?: string
  page?:       number
  limit?:      number
}

export async function listAdminTickets(
  filters: ListAdminFilter,
): Promise<{ tickets: TicketItem[]; total: number; pages: number }> {
  const page  = filters.page  ?? 1
  const limit = filters.limit ?? 20
  const skip  = (page - 1) * limit

  const filter: Record<string, unknown> = {}
  if (filters.status)     filter.status = filters.status
  if (filters.priority)   filter.priority = filters.priority
  if (filters.assignedTo && mongoose.Types.ObjectId.isValid(filters.assignedTo)) {
    filter.assignedTo = new mongoose.Types.ObjectId(filters.assignedTo)
  }

  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SupportTicket.countDocuments(filter),
  ])

  return {
    tickets: (tickets as unknown as TicketLean[]).map(toTicketItem),
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  }
}

export async function listMyTickets(
  requestedBy: mongoose.Types.ObjectId,
  opts: { page?: number; limit?: number },
): Promise<{ tickets: TicketItem[]; total: number; pages: number }> {
  const page  = opts.page  ?? 1
  const limit = opts.limit ?? 20
  const skip  = (page - 1) * limit
  const filter = { requestedBy }

  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SupportTicket.countDocuments(filter),
  ])

  return {
    tickets: (tickets as unknown as TicketLean[]).map(toTicketItem),
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  }
}

async function fetchMessages(ticketId: mongoose.Types.ObjectId, includeInternal: boolean): Promise<MessageItem[]> {
  const filter: Record<string, unknown> = { ticketId }
  if (!includeInternal) filter.isInternal = false
  const messages = await TicketMessage.find(filter).sort({ createdAt: 1 }).lean()
  return (messages as unknown as MessageLean[]).map(toMessageItem)
}


export async function getAdminTicket(id: string): Promise<TicketWithMessages | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null
  const ticket = await SupportTicket.findById(id).lean()
  if (!ticket) return null
  const t = ticket as TicketLean
  const messages = await fetchMessages(t._id, true)
  return { ...toTicketItem(t), messages }
}

export async function getUserTicket(
  id:          string,
  requestedBy: mongoose.Types.ObjectId,
): Promise<TicketWithMessages | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null
  const ticket = await SupportTicket.findById(id).lean()
  if (!ticket) return null
  const t = ticket as TicketLean
  if (t.requestedBy.toString() !== requestedBy.toString()) throw new ForbiddenError('Access denied')
  const messages = await fetchMessages(t._id, false)
  return { ...toTicketItem(t), messages }
}

export interface UpdateTicketMetaInput {
  status?:     TicketStatus
  priority?:   TicketPriority
  assignedTo?: string | null
}

export async function updateTicketMeta(id: string, update: UpdateTicketMetaInput): Promise<TicketItem> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError('Ticket not found')

  const set: Record<string, unknown> = {}
  if (update.status)   set.status   = update.status
  if (update.priority) set.priority = update.priority
  if (update.assignedTo !== undefined) {
    set.assignedTo = update.assignedTo && mongoose.Types.ObjectId.isValid(update.assignedTo)
      ? new mongoose.Types.ObjectId(update.assignedTo)
      : null
  }

  const ticket = await SupportTicket.findOneAndUpdate(
    { _id: id },
    { $set: set },
    { new: true },
  )
  if (!ticket) throw new NotFoundError('Ticket not found')
  return toTicketItem(ticket as unknown as TicketLean)
}

export async function addMessage(
  ticketId: string,
  userId:   mongoose.Types.ObjectId,
  input:    { body: string; isInternal: boolean },
  files:    Express.Multer.File[] = [],
): Promise<MessageItem> {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) throw new NotFoundError('Ticket not found')
  const ticket = await SupportTicket.findById(ticketId)
  if (!ticket) throw new NotFoundError('Ticket not found')

  const attachments = await saveFiles(files)

  const message = await TicketMessage.create({
    ticketId: ticket._id,
    userId,
    body:       input.body,
    isInternal: input.isInternal,
    attachments,
  })

  return toMessageItem(message as unknown as MessageLean)
}

export { streamFromGridFS }
export type { Response }
