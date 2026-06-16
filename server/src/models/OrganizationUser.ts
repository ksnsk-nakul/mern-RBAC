import mongoose, { type Document, type Model } from 'mongoose'

export type OrgRole   = 'owner' | 'admin' | 'member'
export type OrgStatus = 'active' | 'pending' | 'suspended'

export interface IOrganizationUser extends Document {
  orgId:            mongoose.Types.ObjectId
  userId:           mongoose.Types.ObjectId
  orgRole:          OrgRole
  status:           OrgStatus
  invitationToken?: string   // SHA-256 hash of raw token; raw never stored
  invitedBy?:       mongoose.Types.ObjectId
  createdAt:        Date
  updatedAt:        Date
}

const schema = new mongoose.Schema<IOrganizationUser>(
  {
    orgId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User',         required: true },
    orgRole:         { type: String, enum: ['owner', 'admin', 'member'], required: true },
    status:          { type: String, enum: ['active', 'pending', 'suspended'], default: 'active' },
    invitationToken: { type: String, select: false },
    invitedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

schema.index({ orgId: 1, userId: 1 }, { unique: true })
schema.index({ userId: 1, status:  1 })
schema.index({ invitationToken: 1 }, { unique: true, sparse: true })

export const OrganizationUser: Model<IOrganizationUser> = mongoose.model('OrganizationUser', schema)
