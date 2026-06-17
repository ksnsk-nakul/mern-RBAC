import mongoose, { type Document, type Model } from 'mongoose'
import type { WebhookEventType } from './WebhookEndpoint.js'

export type DeliveryStatus = 'pending' | 'success' | 'failed'

export interface IWebhookDelivery extends Document {
  webhookId:       mongoose.Types.ObjectId
  orgId:           mongoose.Types.ObjectId
  event:           WebhookEventType
  payload:         Record<string, unknown>
  status:          DeliveryStatus
  attempts:        number
  responseStatus?: number
  responseBody?:   string
  nextRetryAt?:    Date
  lastAttemptAt?:  Date
  createdAt:       Date
  updatedAt:       Date
}

const schema = new mongoose.Schema<IWebhookDelivery>(
  {
    webhookId:      { type: mongoose.Schema.Types.ObjectId, ref: 'WebhookEndpoint', required: true },
    orgId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    event:          { type: String, required: true },
    payload:        { type: mongoose.Schema.Types.Mixed, required: true },
    status:         { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
    attempts:       { type: Number, default: 0 },
    responseStatus: { type: Number },
    responseBody:   { type: String },
    nextRetryAt:    { type: Date },
    lastAttemptAt:  { type: Date },
  },
  { timestamps: true },
)

schema.index({ webhookId: 1, createdAt: -1 })
schema.index({ status: 1, nextRetryAt: 1 })

export const WebhookDelivery: Model<IWebhookDelivery> = mongoose.model('WebhookDelivery', schema)
