import type { Request, Response } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { asyncHandler } from '../../lib/errors.js'
import * as BillingService from '../../services/billing.service.js'
import * as ActivityLogService from '../../services/activityLog.service.js'

interface AuthUser { userId: mongoose.Types.ObjectId }

const createPlanSchema = z.object({
  name:          z.string().min(1).max(100),
  slug:          z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  priceCents:    z.number().int().min(0),
  currency:      z.string().min(3).max(3).default('usd'),
  billingPeriod: z.enum(['month', 'year']),
  features:      z.array(z.string()).default([]),
  stripePriceId: z.string().min(1),
})

const updatePlanSchema = z.object({
  name:          z.string().min(1).max(100).optional(),
  slug:          z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  priceCents:    z.number().int().min(0).optional(),
  currency:      z.string().min(3).max(3).optional(),
  billingPeriod: z.enum(['month', 'year']).optional(),
  features:      z.array(z.string()).optional(),
  stripePriceId: z.string().min(1).optional(),
  active:        z.boolean().optional(),
})

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const plans = await BillingService.listPlans()
  res.json({ plans })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createPlanSchema.parse(req.body)
  const auth  = req.user as unknown as AuthUser

  const plan = await BillingService.createPlan(input)

  ActivityLogService.appendActivity({
    action:     'plan.created',
    actorId:    auth.userId,
    targetType: 'plan',
    targetId:   plan.id,
    targetName: plan.name,
  }).catch(() => {})

  res.status(201).json({ plan })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const input = updatePlanSchema.parse(req.body)
  const auth  = req.user as unknown as AuthUser

  const plan = await BillingService.updatePlan(req.params.id as string, input)

  ActivityLogService.appendActivity({
    action:     'plan.updated',
    actorId:    auth.userId,
    targetType: 'plan',
    targetId:   req.params.id as string,
    meta:       input,
  }).catch(() => {})

  res.json({ plan })
})
