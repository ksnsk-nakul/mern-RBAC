import mongoose, { type Document, type Model } from 'mongoose'

export interface IPlan extends Document {
  name:          string
  slug:          string
  priceCents:    number
  currency:      string
  billingPeriod: 'month' | 'year'
  features:      string[]
  stripePriceId: string
  active:        boolean
  createdAt:     Date
  updatedAt:     Date
}

const schema = new mongoose.Schema<IPlan>(
  {
    name:          { type: String, required: true, trim: true },
    slug:          { type: String, required: true, unique: true, lowercase: true },
    priceCents:    { type: Number, required: true, min: 0 },
    currency:      { type: String, required: true, default: 'usd' },
    billingPeriod: { type: String, enum: ['month', 'year'], required: true },
    features:      [{ type: String }],
    stripePriceId: { type: String, required: true },
    active:        { type: Boolean, default: true },
  },
  { timestamps: true },
)

schema.index({ active: 1 })

export const Plan: Model<IPlan> = mongoose.model('Plan', schema)
