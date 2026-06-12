import mongoose, { type Document, type Model } from 'mongoose'

export interface IApiToken extends Document {
  userId:      mongoose.Types.ObjectId
  name:        string
  tokenHash:   string
  prefix:      string
  scopes:      string[]
  lastUsedAt?: Date
  expiresAt?:  Date
  revokedAt?:  Date
}

const schema = new mongoose.Schema<IApiToken>(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:       { type: String, required: true },
    tokenHash:  { type: String, required: true, unique: true },
    prefix:     { type: String, required: true },
    scopes:     { type: [String], default: [] },
    lastUsedAt: { type: Date },
    expiresAt:  { type: Date },
    revokedAt:  { type: Date },
  },
  { timestamps: true },
)

schema.index({ userId: 1 })
schema.index({ tokenHash: 1 })

export const ApiToken: Model<IApiToken> = mongoose.model('ApiToken', schema)
