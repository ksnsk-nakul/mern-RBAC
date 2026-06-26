import mongoose from 'mongoose'
import { User }       from '../models/User.js'
import { Role }       from '../models/Role.js'
import { Permission } from '../models/Permission.js'
import { UserRole }   from '../models/UserRole.js'
import type { ISupportTicket } from '../models/SupportTicket.js'
import { sendEmail } from './email.service.js'
import { env }        from '../config/env.js'

async function getUserEmail(userId: mongoose.Types.ObjectId): Promise<string | null> {
  const user = await User.findById(userId).select('email').lean()
  return (user as { email?: string } | null)?.email ?? null
}

async function getTicketManagerEmails(): Promise<string[]> {
  const perm = await Permission.findOne({ slug: 'tickets.manage' }).select('_id').lean()
  if (!perm) return []
  const roles = await Role.find({ permissions: perm._id }).select('_id').lean()
  if (roles.length === 0) return []
  const userRoles = await UserRole.find({ roleId: { $in: roles.map((r) => r._id) } }).select('userId').lean()
  if (userRoles.length === 0) return []
  const users = await User.find({ _id: { $in: userRoles.map((ur) => ur.userId) } }).select('email').lean()
  return (users as { email: string }[]).map((u) => u.email)
}

function ticketUrl(ticketId: mongoose.Types.ObjectId, isAdmin: boolean): string {
  return `${env.CLIENT_URL}/${isAdmin ? 'admin' : 'dashboard'}/tickets/${ticketId}`
}

export async function notifyNewMessage(
  ticket: ISupportTicket,
  actorUserId: mongoose.Types.ObjectId,
  isInternal: boolean,
): Promise<void> {
  const idSuffix = String(ticket._id).slice(-8)
  const subjectLine = `[Ticket #${idSuffix}] ${ticket.subject}`
  const isAdminReply = isInternal || actorUserId.toString() !== ticket.requestedBy.toString()

  if (isAdminReply) {
    const email = await getUserEmail(ticket.requestedBy)
    if (email) {
      await sendEmail(
        email,
        subjectLine,
        `<p>Your support ticket has a new reply.</p><p><a href="${ticketUrl(ticket._id as mongoose.Types.ObjectId, false)}">View ticket</a></p>`,
      )
    }
  } else {
    if (ticket.assignedTo) {
      const email = await getUserEmail(ticket.assignedTo)
      if (email) {
        await sendEmail(
          email,
          subjectLine,
          `<p>A user replied to their support ticket.</p><p><a href="${ticketUrl(ticket._id as mongoose.Types.ObjectId, true)}">View ticket</a></p>`,
        )
      }
    } else {
      const emails = await getTicketManagerEmails()
      for (const email of emails) {
        await sendEmail(
          email,
          subjectLine,
          `<p>A user replied to an unassigned ticket.</p><p><a href="${ticketUrl(ticket._id as mongoose.Types.ObjectId, true)}">View ticket</a></p>`,
        )
      }
    }
  }
}

export async function notifyStatusChange(ticket: ISupportTicket, newStatus: string): Promise<void> {
  const email = await getUserEmail(ticket.requestedBy)
  if (!email) return
  const idSuffix = String(ticket._id).slice(-8)
  await sendEmail(
    email,
    `[Ticket #${idSuffix}] Status updated: ${newStatus}`,
    `<p>Your ticket status changed to <strong>${newStatus}</strong>.</p><p><a href="${ticketUrl(ticket._id as mongoose.Types.ObjectId, false)}">View ticket</a></p>`,
  )
}

export async function notifyAssignment(ticket: ISupportTicket, assignedToId: mongoose.Types.ObjectId): Promise<void> {
  const email = await getUserEmail(assignedToId)
  if (!email) return
  const idSuffix = String(ticket._id).slice(-8)
  await sendEmail(
    email,
    `[Ticket #${idSuffix}] Assigned to you`,
    `<p>A support ticket has been assigned to you.</p><p><a href="${ticketUrl(ticket._id as mongoose.Types.ObjectId, true)}">View ticket</a></p>`,
  )
}
