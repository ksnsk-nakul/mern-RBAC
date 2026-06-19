import mongoose, { type Document, type Model } from 'mongoose'

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'incomplete'

export interface ISubscription extends Document {
  orgId:                 mongoose.Types.ObjectId
  planId:                mongoose.Types.ObjectId
  stripeCustomerId?:     string
  stripeSubscriptionId?: string
  status:                SubscriptionStatus
  currentPeriodEnd?:     Date
  cancelAtPeriodEnd:     boolean
  createdAt:             Date
  updatedAt:             Date
}

const schema = new mongoose.Schema<ISubscription>(
  {
    orgId:                { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true },
    planId:               { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
    stripeCustomerId:     { type: String },
    stripeSubscriptionId: { type: String },
    status:               { type: String, enum: ['active', 'past_due', 'canceled', 'incomplete'], default: 'incomplete' },
    currentPeriodEnd:     { type: Date },
    cancelAtPeriodEnd:    { type: Boolean, default: false },
  },
  { timestamps: true },
)

schema.index({ stripeSubscriptionId: 1 }, { unique: true, sparse: true })

export const Subscription: Model<ISubscription> = mongoose.model('Subscription', schema)
