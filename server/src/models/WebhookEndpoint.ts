import mongoose, { type Document, type Model } from 'mongoose'

export const WEBHOOK_EVENT_TYPES = [
  'login.success',
  'login.failed',
  'mfa.enabled',
  'mfa.disabled',
  'secret.revealed',
  'user.role_changed',
] as const

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number]

export interface IWebhookEndpoint extends Document {
  orgId:          mongoose.Types.ObjectId
  url:            string
  events:         WebhookEventType[]
  encryptedValue: string
  iv:             string
  authTag:        string
  active:         boolean
  createdBy:      mongoose.Types.ObjectId
  createdAt:      Date
  updatedAt:      Date
}

const schema = new mongoose.Schema<IWebhookEndpoint>(
  {
    orgId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    url:            { type: String, required: true, trim: true },
    events:         [{ type: String, enum: WEBHOOK_EVENT_TYPES, required: true }],
    encryptedValue: { type: String, required: true },
    iv:             { type: String, required: true },
    authTag:        { type: String, required: true },
    active:         { type: Boolean, default: true },
    createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)

schema.index({ orgId: 1 })
schema.index({ orgId: 1, active: 1 })

export const WebhookEndpoint: Model<IWebhookEndpoint> = mongoose.model('WebhookEndpoint', schema)
