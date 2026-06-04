import mongoose, { type Document, type Model } from 'mongoose'

export interface IRole extends Document {
  name: string
  slug: string
  route: string
  color: string
  isSubAdmin: boolean
  isDefault: boolean
  isProtected: boolean
  mfaRequired: boolean
  requireIpAllowlist: boolean
}

const schema = new mongoose.Schema<IRole>(
  {
    name:               { type: String, required: true },
    slug:               { type: String, required: true, unique: true },
    route:              { type: String, required: true },
    color:              { type: String, default: '#6366f1' },
    isSubAdmin:         { type: Boolean, default: false },
    isDefault:          { type: Boolean, default: false },
    isProtected:        { type: Boolean, default: false },
    mfaRequired:        { type: Boolean, default: false },
    requireIpAllowlist: { type: Boolean, default: false },
  },
  { timestamps: true },
)

export const Role: Model<IRole> = mongoose.model('Role', schema)
