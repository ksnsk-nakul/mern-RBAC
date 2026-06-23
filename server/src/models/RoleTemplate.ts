import mongoose, { type Document, type Model } from 'mongoose'

export interface IRoleTemplate extends Document {
  name:          string
  description?:  string
  permissionIds: mongoose.Types.ObjectId[]
  createdBy:     mongoose.Types.ObjectId
  createdAt:     Date
  updatedAt:     Date
}

const schema = new mongoose.Schema<IRoleTemplate>(
  {
    name:          { type: String, required: true, trim: true },
    description:   { type: String },
    permissionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Permission' }],
    createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)

export const RoleTemplate: Model<IRoleTemplate> = mongoose.model('RoleTemplate', schema)
