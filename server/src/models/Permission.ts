import mongoose, { type Document, type Model } from 'mongoose'

export interface IPermission extends Document {
  name: string
  slug: string
  mainGroup: string
  isProtected: boolean
}

const schema = new mongoose.Schema<IPermission>(
  {
    name:        { type: String, required: true },
    slug:        { type: String, required: true, unique: true },
    mainGroup:   { type: String, required: true },
    isProtected: { type: Boolean, default: false },
  },
  { timestamps: true },
)

export const Permission: Model<IPermission> = mongoose.model('Permission', schema)
