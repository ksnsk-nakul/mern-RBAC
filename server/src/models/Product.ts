import mongoose, { type Document, type Model } from 'mongoose'

export type BillingCycle = 'monthly' | 'yearly' | 'one_time'

export interface IProduct extends Document {
  name:         string
  slug:         string
  description:  string
  price:        number
  currency:     string
  billingCycle: BillingCycle
  features:     string[]
  isActive:     boolean
  createdAt:    Date
  updatedAt:    Date
}

const schema = new mongoose.Schema<IProduct>(
  {
    name:         { type: String, required: true, trim: true },
    slug:         { type: String, required: true, unique: true, trim: true, lowercase: true },
    description:  { type: String, default: '' },
    price:        { type: Number, required: true, min: 0 },
    currency:     { type: String, default: 'USD', maxlength: 3 },
    billingCycle: { type: String, enum: ['monthly', 'yearly', 'one_time'], default: 'monthly' },
    features:     { type: [String], default: [] },
    isActive:     { type: Boolean, default: true },
  },
  { timestamps: true },
)

schema.index({ slug: 1 })
schema.index({ isActive: 1 })

export const Product: Model<IProduct> = mongoose.model('Product', schema)
