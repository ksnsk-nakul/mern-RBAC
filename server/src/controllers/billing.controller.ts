import type { Request, Response } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { asyncHandler } from '../lib/errors.js'
import * as BillingService from '../services/billing.service.js'
import * as ActivityLogService from '../services/activityLog.service.js'

interface AuthUser { userId: mongoose.Types.ObjectId }

const checkoutSchema = z.object({
  planId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid plan ID'),
})

export const overview = asyncHandler(async (req: Request, res: Response) => {
  const orgId = new mongoose.Types.ObjectId(req.params.orgId as string)
  const result = await BillingService.getBillingOverview(orgId)
  res.json(result)
})

export const checkout = asyncHandler(async (req: Request, res: Response) => {
  const { planId } = checkoutSchema.parse(req.body)
  const auth  = req.user as unknown as AuthUser
  const orgId = new mongoose.Types.ObjectId(req.params.orgId as string)

  const result = await BillingService.createCheckoutSession(orgId, planId)

  ActivityLogService.appendActivity({
    action:     'billing.checkout_started',
    actorId:    auth.userId,
    targetType: 'plan',
    targetId:   planId,
    orgId,
  }).catch(() => {})

  res.json(result)
})

export const portal = asyncHandler(async (req: Request, res: Response) => {
  const orgId = new mongoose.Types.ObjectId(req.params.orgId as string)
  const result = await BillingService.createPortalSession(orgId)
  res.json(result)
})

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const auth  = req.user as unknown as AuthUser
  const orgId = new mongoose.Types.ObjectId(req.params.orgId as string)

  await BillingService.cancelSubscription(orgId)

  ActivityLogService.appendActivity({
    action:     'billing.subscription_canceled',
    actorId:    auth.userId,
    targetType: 'organization',
    targetId:   String(orgId),
    orgId,
  }).catch(() => {})

  res.json({ canceled: true })
})

export const payments = asyncHandler(async (req: Request, res: Response) => {
  const orgId = new mongoose.Types.ObjectId(req.params.orgId as string)
  const page  = Number(req.query.page)  || 1
  const limit = Math.min(Number(req.query.limit) || 20, 100)

  const result = await BillingService.listPayments(orgId, { page, limit })
  res.json(result)
})
