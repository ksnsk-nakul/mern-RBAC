import mongoose, { type Document, type Model } from 'mongoose'

export interface ISetting extends Document {
  group: string
  name: string
  slug: string
  value: unknown
  type: 'string' | 'boolean' | 'number' | 'color' | 'image' | 'json' | 'select'
  options: string[]
  isPublic: boolean
  updatedBy?: mongoose.Types.ObjectId
}

const schema = new mongoose.Schema<ISetting>(
  {
    group:     { type: String, required: true },
    name:      { type: String, required: true },
    slug:      { type: String, required: true, unique: true },
    value:     { type: mongoose.Schema.Types.Mixed },
    type:      { type: String, enum: ['string', 'boolean', 'number', 'color', 'image', 'json', 'select'], required: true },
    options:   [{ type: String }],
    isPublic:  { type: Boolean, default: false },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

schema.index({ group: 1 })

export const Setting: Model<ISetting> = mongoose.model('Setting', schema)
