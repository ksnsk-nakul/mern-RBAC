import mongoose, { type Document, type Model } from 'mongoose'

export interface IUserRole extends Document {
  userId: mongoose.Types.ObjectId
  roleId: mongoose.Types.ObjectId
  isPrimary: boolean
  isActive: boolean
  assignedBy?: mongoose.Types.ObjectId
  assignedAt: Date
}

const schema = new mongoose.Schema<IUserRole>({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  roleId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
  isPrimary:  { type: Boolean, default: false },
  isActive:   { type: Boolean, default: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedAt: { type: Date, default: Date.now },
})

schema.index({ userId: 1, roleId: 1 }, { unique: true })
schema.index({ userId: 1, isActive: 1 })

export const UserRole: Model<IUserRole> = mongoose.model('UserRole', schema)
