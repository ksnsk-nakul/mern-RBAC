import mongoose, { type Document, type Model } from 'mongoose'

export type TicketStatus   = 'open' | 'in_progress' | 'waiting_for_user' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface ISupportTicket extends Document {
  subject:     string
  status:      TicketStatus
  priority:    TicketPriority
  requestedBy: mongoose.Types.ObjectId
  orgId?:      mongoose.Types.ObjectId
  assignedTo?: mongoose.Types.ObjectId
  createdAt:   Date
  updatedAt:   Date
}

const schema = new mongoose.Schema<ISupportTicket>(
  {
    subject:     { type: String, required: true, trim: true },
    status:      { type: String, enum: ['open', 'in_progress', 'waiting_for_user', 'resolved', 'closed'], default: 'open' },
    priority:    { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orgId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

schema.index({ status: 1, createdAt: -1 })
schema.index({ requestedBy: 1, createdAt: -1 })
schema.index({ assignedTo: 1, status: 1 })

export const SupportTicket: Model<ISupportTicket> = mongoose.model('SupportTicket', schema)
