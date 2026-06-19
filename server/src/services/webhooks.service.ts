import crypto from 'crypto'
import { setTimeout as setAbortTimeout, clearTimeout as clearAbortTimeout } from 'timers'
import mongoose from 'mongoose'
import dns from 'dns'
import { URL } from 'url'
import { WebhookEndpoint, type WebhookEventType } from '../models/WebhookEndpoint.js'
import { WebhookDelivery, type DeliveryStatus } from '../models/WebhookDelivery.js'
import { OrganizationUser } from '../models/OrganizationUser.js'
import { encrypt, decrypt } from '../lib/crypto.js'
import { AppError, NotFoundError } from '../lib/errors.js'

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

function isPrivateOrInternalAddress(ip: string): boolean {
  // IPv4 private/reserved ranges
  if (/^127\./.test(ip)) return true                    // loopback
  if (/^10\./.test(ip)) return true                      // RFC1918
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true  // RFC1918
  if (/^192\.168\./.test(ip)) return true                 // RFC1918
  if (/^169\.254\./.test(ip)) return true                 // link-local / cloud metadata
  if (ip === '0.0.0.0') return true
  // IPv6 loopback / link-local / unique-local
  if (ip === '::1') return true
  if (/^fe80:/i.test(ip)) return true
  if (/^fc00:/i.test(ip) || /^fd00:/i.test(ip)) return true
  return false
}

async function assertWebhookUrlIsSafe(rawUrl: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new AppError('Invalid webhook URL', 400)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError('Webhook URL must use http or https', 400)
  }

  const hostname = parsed.hostname
  if (hostname === 'localhost') {
    throw new AppError('Webhook URL cannot target localhost', 400)
  }

  let addresses: { address: string }[]
  try {
    addresses = await dns.promises.lookup(hostname, { all: true })
  } catch {
    throw new AppError('Webhook URL hostname could not be resolved', 400)
  }

  for (const { address } of addresses) {
    if (isPrivateOrInternalAddress(address)) {
      throw new AppError('Webhook URL resolves to a private or internal network address, which is not allowed', 400)
    }
  }
}

export async function createEndpoint(
  orgId:   mongoose.Types.ObjectId,
  input:   { url: string; events: WebhookEventType[] },
  actorId: mongoose.Types.ObjectId,
): Promise<WebhookEndpointItem & { secret: string }> {
  await assertWebhookUrlIsSafe(input.url)

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

  if (input.url !== undefined) {
    await assertWebhookUrlIsSafe(input.url)
  }

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
  orgId:     mongoose.Types.ObjectId,
  webhookId: string,
  opts: { page?: number; limit?: number },
): Promise<{ deliveries: DeliveryItem[]; total: number; pages: number }> {
  const page  = opts.page  ?? 1
  const limit = opts.limit ?? 20
  const skip  = (page - 1) * limit

  if (!mongoose.Types.ObjectId.isValid(webhookId)) {
    return { deliveries: [], total: 0, pages: 0 }
  }

  const filter = { webhookId: new mongoose.Types.ObjectId(webhookId), orgId }

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

const MAX_ATTEMPTS        = 3
const RETRY_DELAYS_MS     = [30_000, 5 * 60_000]  // delay before 2nd attempt, delay before 3rd attempt
const DELIVERY_TIMEOUT_MS = 5_000

export async function dispatchEvent(
  eventType: WebhookEventType,
  userId:    mongoose.Types.ObjectId,
  data:      Record<string, unknown>,
): Promise<void> {
  const memberships = await OrganizationUser.find({ userId, status: 'active' }).lean()
  if (memberships.length === 0) return

  const orgIds = memberships.map((m) => m.orgId)

  const endpoints = await WebhookEndpoint.find({
    orgId:  { $in: orgIds },
    active: true,
    events: eventType,
  }).lean()

  for (const endpoint of endpoints) {
    const payload = {
      event:     eventType,
      orgId:     String(endpoint.orgId),
      timestamp: new Date().toISOString(),
      data,
    }

    const delivery = await WebhookDelivery.create({
      webhookId: endpoint._id,
      orgId:     endpoint.orgId,
      event:     eventType,
      payload,
      status:    'pending',
      attempts:  0,
    })

    attemptDelivery(String(delivery._id)).catch(() => {})
  }
}

export async function attemptDelivery(deliveryId: string): Promise<void> {
  const delivery = await WebhookDelivery.findById(deliveryId).lean()
  if (!delivery || delivery.status === 'success') return

  const endpoint = await WebhookEndpoint.findById(delivery.webhookId).lean()
  if (!endpoint || !endpoint.active) {
    await WebhookDelivery.updateOne({ _id: deliveryId }, { $set: { status: 'failed' } })
    return
  }

  const attempts      = delivery.attempts + 1
  const lastAttemptAt = new Date()

  let responseStatus: number | undefined
  let responseBody:   string | undefined
  let errorMessage:   string | undefined

  try {
    const secret    = decrypt({ encryptedValue: endpoint.encryptedValue, iv: endpoint.iv, authTag: endpoint.authTag })
    const body      = JSON.stringify(delivery.payload)
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex')

    await assertWebhookUrlIsSafe(endpoint.url)

    const controller = new AbortController()
    const timeout = setAbortTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS)

    const res = await fetch(endpoint.url, {
      method:  'POST',
      headers: {
        'Content-Type':        'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Id':        deliveryId,
      },
      body,
      signal: controller.signal,
    })

    clearAbortTimeout(timeout)

    responseStatus = res.status
    const responseText = await res.text().catch(() => '')
    responseBody = responseText.slice(0, 1000)

    if (res.ok) {
      await WebhookDelivery.updateOne(
        { _id: deliveryId },
        { $set: { status: 'success', attempts, lastAttemptAt, responseStatus, responseBody } },
      )
      return
    }

    errorMessage = `Non-2xx response: ${responseStatus}`
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err)
  }

  if (attempts >= MAX_ATTEMPTS) {
    console.error(`Webhook delivery ${deliveryId} permanently failed after ${attempts} attempts: ${errorMessage}`)
    await WebhookDelivery.updateOne(
      { _id: deliveryId },
      { $set: { status: 'failed', attempts, lastAttemptAt, responseStatus, responseBody } },
    )
    return
  }

  console.error(`Webhook delivery ${deliveryId} attempt ${attempts} failed, will retry: ${errorMessage}`)

  const delayMs     = RETRY_DELAYS_MS[attempts - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!
  const nextRetryAt = new Date(Date.now() + delayMs)

  await WebhookDelivery.updateOne(
    { _id: deliveryId },
    { $set: { attempts, lastAttemptAt, nextRetryAt, responseStatus, responseBody } },
  )

  setTimeout(() => {
    attemptDelivery(deliveryId).catch(() => {})
  }, delayMs)
}

export async function retryFailedDeliveries(): Promise<void> {
  const now = new Date()
  const pending = await WebhookDelivery.find({
    status: 'pending',
    $or: [{ nextRetryAt: null }, { nextRetryAt: { $lte: now } }],
  }).lean()

  for (const delivery of pending) {
    attemptDelivery(String(delivery._id)).catch(() => {})
  }
}

export async function retryDeliveryManually(orgId: mongoose.Types.ObjectId, deliveryId: string): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(deliveryId)) throw new NotFoundError('Delivery not found')

  const delivery = await WebhookDelivery.findOne({ _id: deliveryId, orgId })
  if (!delivery) throw new NotFoundError('Delivery not found')

  await WebhookDelivery.updateOne(
    { _id: deliveryId },
    { $set: { attempts: 0, status: 'pending', nextRetryAt: null } },
  )

  await attemptDelivery(deliveryId)
}
