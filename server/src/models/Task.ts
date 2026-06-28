import mongoose, { type Document, type Model } from 'mongoose'

export type TaskStatus   = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface ITask extends Document {
  userId:      mongoose.Types.ObjectId
  projectId:   mongoose.Types.ObjectId | null
  title:       string
  status:      TaskStatus
  priority:    TaskPriority
  dueDate:     Date | null
  notes:       string
  completedAt: Date | null
  createdAt:   Date
  updatedAt:   Date
}

const schema = new mongoose.Schema<ITask>(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    projectId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    title:       { type: String, required: true, trim: true },
    status:      { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' },
    priority:    { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    dueDate:     { type: Date, default: null },
    notes:       { type: String, default: '' },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

schema.index({ userId: 1, projectId: 1, status: 1, dueDate: 1 })

export const Task: Model<ITask> = mongoose.model('Task', schema)
