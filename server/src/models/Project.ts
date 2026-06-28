import mongoose, { type Document, type Model } from 'mongoose'

export type ProjectStatus = 'active' | 'paused' | 'completed'

export interface IProject extends Document {
  userId:      mongoose.Types.ObjectId
  title:       string
  description: string
  status:      ProjectStatus
  progress:    number
  archivedAt:  Date | null
  createdAt:   Date
  updatedAt:   Date
}

const schema = new mongoose.Schema<IProject>(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title:       { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    status:      { type: String, enum: ['active', 'paused', 'completed'], default: 'active' },
    progress:    { type: Number, min: 0, max: 100, default: 0 },
    archivedAt:  { type: Date, default: null },
  },
  { timestamps: true },
)

schema.index({ userId: 1, archivedAt: 1 })

export const Project: Model<IProject> = mongoose.model('Project', schema)
