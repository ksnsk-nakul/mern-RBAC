import type { Request, Response } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { asyncHandler } from '../lib/errors.js'
import * as WebhooksService from '../services/webhooks.service.js'
import * as ActivityLogService from '../services/activityLog.service.js'
import { WEBHOOK_EVENT_TYPES } from '../models/WebhookEndpoint.js'

interface AuthUser { userId: mongoose.Types.ObjectId }

const createSchema = z.object({
  url:    z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1),
})

const updateSchema = z.object({
  url:    z.string().url().optional(),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1).optional(),
  active: z.boolean().optional(),
})

export const list = asyncHandler(async (req: Request, res: Response) => {
  const orgId = new mongoose.Types.ObjectId(req.params.orgId as string)
  const endpoints = await WebhooksService.listEndpoints(orgId)
  res.json({ endpoints })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createSchema.parse(req.body)
  const auth  = req.user as unknown as AuthUser
  const orgId = new mongoose.Types.ObjectId(req.params.orgId as string)

  const endpoint = await WebhooksService.createEndpoint(orgId, input, auth.userId)

  ActivityLogService.appendActivity({
    action:     'webhook.created',
    actorId:    auth.userId,
    targetType: 'webhook',
    targetId:   endpoint.id,
    targetName: endpoint.url,
    orgId,
  }).catch(() => {})

  res.status(201).json({ endpoint })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const input = updateSchema.parse(req.body)
  const auth  = req.user as unknown as AuthUser
  const orgId = new mongoose.Types.ObjectId(req.params.orgId as string)

  const endpoint = await WebhooksService.updateEndpoint(orgId, req.params.id as string, input)

  ActivityLogService.appendActivity({
    action:     'webhook.updated',
    actorId:    auth.userId,
    targetType: 'webhook',
    targetId:   req.params.id as string,
    meta:       input,
    orgId,
  }).catch(() => {})

  res.json({ endpoint })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const auth  = req.user as unknown as AuthUser
  const orgId = new mongoose.Types.ObjectId(req.params.orgId as string)

  await WebhooksService.deleteEndpoint(orgId, req.params.id as string)

  ActivityLogService.appendActivity({
    action:     'webhook.deleted',
    actorId:    auth.userId,
    targetType: 'webhook',
    targetId:   req.params.id as string,
    orgId,
  }).catch(() => {})

  res.json({ deleted: true })
})

export const regenerateSecret = asyncHandler(async (req: Request, res: Response) => {
  const auth  = req.user as unknown as AuthUser
  const orgId = new mongoose.Types.ObjectId(req.params.orgId as string)

  const result = await WebhooksService.regenerateSecret(orgId, req.params.id as string)

  ActivityLogService.appendActivity({
    action:     'webhook.secret_regenerated',
    actorId:    auth.userId,
    targetType: 'webhook',
    targetId:   req.params.id as string,
    orgId,
  }).catch(() => {})

  res.json(result)
})

export const listDeliveries = asyncHandler(async (req: Request, res: Response) => {
  const orgId = new mongoose.Types.ObjectId(req.params.orgId as string)
  const page  = Number(req.query.page)  || 1
  const limit = Math.min(Number(req.query.limit) || 20, 100)

  const result = await WebhooksService.listDeliveries(orgId, req.params.id as string, { page, limit })
  res.json(result)
})

export const retryDelivery = asyncHandler(async (req: Request, res: Response) => {
  const auth   = req.user as unknown as AuthUser
  const orgId  = new mongoose.Types.ObjectId(req.params.orgId as string)
  const deliveryId = req.params.deliveryId as string
  await WebhooksService.retryDeliveryManually(orgId, deliveryId)
  ActivityLogService.appendActivity({
    action:     'webhook_delivery.retried',
    actorId:    auth.userId,
    targetType: 'WebhookDelivery',
    targetId:   deliveryId,
    orgId,
  }).catch(() => {})
  res.json({ retried: true })
})
