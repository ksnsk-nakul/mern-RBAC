import mongoose, { type Document, type Model } from 'mongoose'

export interface IPaymentEvent extends Document {
  orgId:          mongoose.Types.ObjectId
  subscriptionId: mongoose.Types.ObjectId
  stripeEventId:  string
  type:           string
  amountCents?:   number
  status?:        string
  raw:            Record<string, unknown>
  createdAt:      Date
}

const schema = new mongoose.Schema<IPaymentEvent>(
  {
    orgId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true },
    stripeEventId:  { type: String, required: true, unique: true },
    type:           { type: String, required: true },
    amountCents:    { type: Number },
    status:         { type: String },
    raw:            { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

schema.index({ orgId: 1, createdAt: -1 })

export const PaymentEvent: Model<IPaymentEvent> = mongoose.model('PaymentEvent', schema)
