import mongoose, { type Document, type Model } from 'mongoose'

export interface IActivityLog extends Document {
  action:      string
  actorId?:    mongoose.Types.ObjectId
  actorEmail?: string
  targetType?: string
  targetId?:   string
  targetName?: string
  meta?:       Record<string, unknown>
  prevHash:    string
  hash:        string
  createdAt:   Date
}

const schema = new mongoose.Schema<IActivityLog>(
  {
    action:      { type: String, required: true },
    actorId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorEmail:  { type: String },
    targetType:  { type: String },
    targetId:    { type: String },
    targetName:  { type: String },
    meta:        { type: mongoose.Schema.Types.Mixed },
    prevHash:    { type: String, required: true },
    hash:        { type: String, required: true, unique: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

schema.index({ createdAt: -1 })
schema.index({ actorId:   1 })
schema.index({ action:    1, createdAt: -1 })

export const ActivityLog: Model<IActivityLog> = mongoose.model('ActivityLog', schema)
