import mongoose, { type Document, type Model } from 'mongoose'

export type RequestType   = 'role_assignment' | 'permission_grant'
export type RequestStatus = 'pending' | 'approved' | 'rejected'

export interface IApprovalRequest extends Document {
  requestType:         RequestType
  requestedBy:         mongoose.Types.ObjectId
  targetUserId?:       mongoose.Types.ObjectId
  targetRoleId:        mongoose.Types.ObjectId
  targetPermissionId?: mongoose.Types.ObjectId
  status:              RequestStatus
  reason?:             string
  decisionNote?:       string
  approvedBy?:         mongoose.Types.ObjectId
  decidedAt?:          Date
  createdAt:           Date
  updatedAt:           Date
}

const schema = new mongoose.Schema<IApprovalRequest>(
  {
    requestType:         { type: String, enum: ['role_assignment', 'permission_grant'], required: true },
    requestedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetUserId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    targetRoleId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
    targetPermissionId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Permission' },
    status:              { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reason:              { type: String },
    decisionNote:        { type: String },
    approvedBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decidedAt:           { type: Date },
  },
  { timestamps: true },
)

schema.index({ status: 1, createdAt: -1 })
schema.index({ requestedBy: 1, createdAt: -1 })

export const ApprovalRequest: Model<IApprovalRequest> = mongoose.model('ApprovalRequest', schema)
