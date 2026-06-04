import mongoose, { type Document, type Model } from 'mongoose'

export interface IRefreshToken extends Document {
  userId: mongoose.Types.ObjectId
  tokenHash: string
  expiresAt: Date
}

const schema = new mongoose.Schema<IRefreshToken>({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
})

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const RefreshToken: Model<IRefreshToken> = mongoose.model('RefreshToken', schema)
