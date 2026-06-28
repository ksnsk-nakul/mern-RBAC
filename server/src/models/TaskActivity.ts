import mongoose, { type Document, type Model } from 'mongoose'

export type TaskActivityAction = 'created' | 'updated' | 'completed' | 'reopened' | 'commented'

export interface ITaskActivity extends Document {
  taskId:      mongoose.Types.ObjectId
  userId:      mongoose.Types.ObjectId
  action:      TaskActivityAction
  description: string
  meta:        Record<string, unknown>
  createdAt:   Date
}

const schema = new mongoose.Schema<ITaskActivity>(
  {
    taskId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action:      { type: String, enum: ['created', 'updated', 'completed', 'reopened', 'commented'], required: true },
    description: { type: String, required: true },
    meta:        { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

schema.index({ taskId: 1, createdAt: 1 })

export const TaskActivity: Model<ITaskActivity> = mongoose.model('TaskActivity', schema)
