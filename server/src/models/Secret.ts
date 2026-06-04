import mongoose, { type Document, type Model } from 'mongoose'

export interface ISecret extends Document {
  group: string
  name: string
  slug: string
  encryptedValue?: string
  iv?: string
  authTag?: string
  isSet: boolean
  updatedBy?: mongoose.Types.ObjectId
}

const schema = new mongoose.Schema<ISecret>(
  {
    group:          { type: String, required: true },
    name:           { type: String, required: true },
    slug:           { type: String, required: true, unique: true },
    encryptedValue: { type: String },
    iv:             { type: String },
    authTag:        { type: String },
    isSet:          { type: Boolean, default: false },
    updatedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

schema.index({ group: 1 })

export const Secret: Model<ISecret> = mongoose.model('Secret', schema)
