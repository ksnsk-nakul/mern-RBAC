import mongoose, { type Document, type Model } from 'mongoose'

export interface ILoginActivityLog extends Document {
  ip:          string
  userAgent:   string
  roleSlug:    string
  success:     boolean
  failReason?: string
  createdAt:   Date
}

const schema = new mongoose.Schema<ILoginActivityLog>(
  {
    ip:         { type: String, required: true },
    userAgent:  { type: String, required: true },
    roleSlug:   { type: String, required: true },
    success:    { type: Boolean, required: true },
    failReason: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

schema.index({ createdAt: -1 })
schema.index({ success: 1, createdAt: -1 })
// Auto-delete after 90 days
schema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })

export const LoginActivityLog: Model<ILoginActivityLog> =
  mongoose.model('LoginActivityLog', schema)
