import mongoose, { type Document, type Model } from 'mongoose'

export interface ITicketAttachment {
  filename:    string
  contentType: string
  size:        number
  gridfsId:    mongoose.Types.ObjectId
}

export interface ITicketMessage extends Document {
  ticketId:    mongoose.Types.ObjectId
  userId:      mongoose.Types.ObjectId
  body:        string
  isInternal:  boolean
  attachments: ITicketAttachment[]
  createdAt:   Date
  updatedAt:   Date
}

const attachmentSchema = new mongoose.Schema<ITicketAttachment>(
  {
    filename:    { type: String, required: true },
    contentType: { type: String, required: true },
    size:        { type: Number, required: true },
    gridfsId:    { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { _id: false },
)

const schema = new mongoose.Schema<ITicketMessage>(
  {
    ticketId:   { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket', required: true },
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body:       { type: String, required: true },
    isInternal: { type: Boolean, default: false },
    attachments: { type: [attachmentSchema], default: [] },
  },
  { timestamps: true },
)

schema.index({ ticketId: 1, createdAt: 1 })

export const TicketMessage: Model<ITicketMessage> = mongoose.model('TicketMessage', schema)
