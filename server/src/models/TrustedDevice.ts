import mongoose, { type Document, type Model } from 'mongoose'

export interface ITrustedDevice extends Document {
  userId:      mongoose.Types.ObjectId
  deviceHash:  string
  userAgent:   string
  lastIp:      string
  label:       string
  expiresAt:   Date
}

const schema = new mongoose.Schema<ITrustedDevice>(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    deviceHash: { type: String, required: true },
    userAgent:  { type: String, required: true },
    lastIp:     { type: String, required: true },
    label:      { type: String, required: true },
    expiresAt:  { type: Date,   required: true },
  },
  { timestamps: true },
)

schema.index({ userId: 1, deviceHash: 1 }, { unique: true })
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const TrustedDevice: Model<ITrustedDevice> = mongoose.model('TrustedDevice', schema)
