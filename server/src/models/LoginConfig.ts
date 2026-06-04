import mongoose, { type Document, type Model } from 'mongoose'

export interface ILoginConfig extends Document {
  roleId: mongoose.Types.ObjectId
  template: 'modal' | 'centered' | 'split'
  bgImage?: string
  logoUrl?: string
  brandTitle: string
  brandSubtitle?: string
  googleAuthEnabled: boolean
  updatedBy?: mongoose.Types.ObjectId
}

const schema = new mongoose.Schema<ILoginConfig>(
  {
    roleId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true, unique: true },
    template:          { type: String, enum: ['modal', 'centered', 'split'], default: 'centered' },
    bgImage:           { type: String },
    logoUrl:           { type: String },
    brandTitle:        { type: String, default: 'Sign in' },
    brandSubtitle:     { type: String },
    googleAuthEnabled: { type: Boolean, default: false },
    updatedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

export const LoginConfig: Model<ILoginConfig> = mongoose.model('LoginConfig', schema)
