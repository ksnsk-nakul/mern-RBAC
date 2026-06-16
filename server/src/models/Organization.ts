import mongoose, { type Document, type Model } from 'mongoose'

export interface IOrganization extends Document {
  name:              string
  slug:              string
  addonApiKeyHash?:  string
  createdBy:         mongoose.Types.ObjectId
  createdAt:         Date
  updatedAt:         Date
}

const schema = new mongoose.Schema<IOrganization>(
  {
    name:             { type: String, required: true },
    slug:             { type: String, required: true, unique: true, lowercase: true },
    addonApiKeyHash:  { type: String },
    createdBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)

schema.index({ createdBy: 1 })

export const Organization: Model<IOrganization> = mongoose.model('Organization', schema)
