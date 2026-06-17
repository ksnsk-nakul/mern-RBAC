import crypto from 'crypto'
import mongoose from 'mongoose'
import { WebhookEndpoint, type WebhookEventType } from '../models/WebhookEndpoint.js'
import { WebhookDelivery, type DeliveryStatus } from '../models/WebhookDelivery.js'
import { encrypt } from '../lib/crypto.js'
import { NotFoundError } from '../lib/errors.js'

export interface WebhookEndpointItem {
  id:        string
  url:       string
  events:    WebhookEventType[]
  active:    boolean
  createdAt: string
}

export interface DeliveryItem {
  id:              string
  event:           WebhookEventType
  status:          DeliveryStatus
  attempts:        number
  responseStatus?: number
  createdAt:       string
}

function generateRawSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

export async function createEndpoint(
  orgId:   mongoose.Types.ObjectId,
  input:   { url: string; events: WebhookEventType[] },
  actorId: mongoose.Types.ObjectId,
): Promise<WebhookEndpointItem & { secret: string }> {
  const rawSecret = generateRawSecret()
  const encrypted  = encrypt(rawSecret)

  const endpoint = await WebhookEndpoint.create({
    orgId,
    url:            input.url,
    events:         input.events,
    encryptedValue: encrypted.encryptedValue,
    iv:             encrypted.iv,
    authTag:        encrypted.authTag,
    active:         true,
    createdBy:      actorId,
  })

  return {
    id:        String(endpoint._id),
    url:       endpoint.url,
    events:    endpoint.events,
    active:    endpoint.active,
    createdAt: new Date().toISOString(),
    secret:    rawSecret,
  }
}

export async function listEndpoints(orgId: mongoose.Types.ObjectId): Promise<WebhookEndpointItem[]> {
  const endpoints = await WebhookEndpoint.find({ orgId })
    .select('-encryptedValue -iv -authTag')
    .sort({ createdAt: -1 })
    .lean()

  return endpoints.map((e) => ({
    id:        String(e._id),
    url:       e.url,
    events:    e.events,
    active:    e.active,
    createdAt: (e as any).createdAt?.toISOString() ?? '',
  }))
}

export async function updateEndpoint(
  orgId: mongoose.Types.ObjectId,
  id:    string,
  input: { url?: string; events?: WebhookEventType[]; active?: boolean },
): Promise<WebhookEndpointItem> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError('Webhook endpoint not found')

  const update: Record<string, unknown> = {}
  if (input.url !== undefined)    update.url    = input.url
  if (input.events !== undefined) update.events = input.events
  if (input.active !== undefined) update.active = input.active

  const endpoint = await WebhookEndpoint.findOneAndUpdate(
    { _id: id, orgId },
    { $set: update },
    { new: true },
  ).select('-encryptedValue -iv -authTag')

  if (!endpoint) throw new NotFoundError('Webhook endpoint not found')

  return {
    id:        String(endpoint._id),
    url:       endpoint.url,
    events:    endpoint.events,
    active:    endpoint.active,
    createdAt: (endpoint as any).createdAt?.toISOString() ?? '',
  }
}

export async function deleteEndpoint(orgId: mongoose.Types.ObjectId, id: string): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError('Webhook endpoint not found')
  const result = await WebhookEndpoint.deleteOne({ _id: id, orgId })
  if (result.deletedCount === 0) throw new NotFoundError('Webhook endpoint not found')
}

export async function regenerateSecret(orgId: mongoose.Types.ObjectId, id: string): Promise<{ secret: string }> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError('Webhook endpoint not found')

  const rawSecret = generateRawSecret()
  const encrypted  = encrypt(rawSecret)

  const result = await WebhookEndpoint.updateOne(
    { _id: id, orgId },
    { $set: { encryptedValue: encrypted.encryptedValue, iv: encrypted.iv, authTag: encrypted.authTag } },
  )

  if (result.matchedCount === 0) throw new NotFoundError('Webhook endpoint not found')

  return { secret: rawSecret }
}

export async function listDeliveries(
  webhookId: string,
  opts: { page?: number; limit?: number },
): Promise<{ deliveries: DeliveryItem[]; total: number; pages: number }> {
  const page  = opts.page  ?? 1
  const limit = opts.limit ?? 20
  const skip  = (page - 1) * limit

  const filter = { webhookId: new mongoose.Types.ObjectId(webhookId) }

  const [deliveries, total] = await Promise.all([
    WebhookDelivery.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    WebhookDelivery.countDocuments(filter),
  ])

  return {
    deliveries: deliveries.map((d) => ({
      id:             String(d._id),
      event:          d.event,
      status:         d.status,
      attempts:       d.attempts,
      responseStatus: d.responseStatus,
      createdAt:      (d as any).createdAt?.toISOString() ?? '',
    })),
    total,
    pages: Math.ceil(total / limit),
  }
}
