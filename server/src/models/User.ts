import mongoose, { type Document, type Model } from 'mongoose'

export interface IUser extends Document {
  name: string
  email: string
  password?: string
  googleId?: string
  avatarUrl?: string
  isFounder: boolean
  emailVerifiedAt?: Date
  currentOrganization?: mongoose.Types.ObjectId
  deletedAt?: Date
  mfaEnabled:       boolean
  mfaTotpSecret?:   string
  mfaRecoveryCodes: string[]
}

const schema = new mongoose.Schema<IUser>(
  {
    name:                { type: String, required: true },
    email:               { type: String, required: true, unique: true, lowercase: true },
    password:            { type: String },
    googleId:            { type: String, sparse: true, unique: true },
    avatarUrl:           { type: String },
    isFounder:           { type: Boolean, default: false },
    emailVerifiedAt:     { type: Date },
    currentOrganization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    deletedAt:           { type: Date },
    mfaEnabled:       { type: Boolean, default: false },
    mfaTotpSecret:    { type: String, select: false },
    mfaRecoveryCodes: { type: [String], default: [], select: false },
  },
  { timestamps: true },
)

schema.index({ email: 1, deletedAt: 1 })

export const User: Model<IUser> = mongoose.model('User', schema)
