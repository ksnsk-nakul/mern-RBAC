import mongoose, { type Document, type Model } from 'mongoose'
import crypto from 'crypto'

export type LicenseStatus = 'active' | 'suspended' | 'expired'

export interface ILicense extends Document {
  userId:    mongoose.Types.ObjectId
  productId: mongoose.Types.ObjectId
  key:       string
  status:    LicenseStatus
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const schema = new mongoose.Schema<ILicense>(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    key:       { type: String, required: true, unique: true, default: () => crypto.randomBytes(24).toString('hex') },
    status:    { type: String, enum: ['active', 'suspended', 'expired'], default: 'active' },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
)

schema.index({ userId: 1, productId: 1 })
schema.index({ key: 1 })

export const License: Model<ILicense> = mongoose.model('License', schema)
