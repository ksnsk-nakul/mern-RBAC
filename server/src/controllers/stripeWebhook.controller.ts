import type { Request, Response } from 'express'
import Stripe from 'stripe'
import { asyncHandler, AppError } from '../lib/errors.js'
import * as SecretsService from '../services/secrets.service.js'
import * as BillingService from '../services/billing.service.js'

export const handleStripeWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature']
  if (!signature || typeof signature !== 'string') {
    throw new AppError('Missing Stripe signature', 400)
  }

  const [webhookSecret, stripeSecretKey] = await Promise.all([
    SecretsService.revealSecret('stripe.webhook_secret'),
    SecretsService.revealSecret('stripe.secret_key'),
  ])

  const stripe = new Stripe(stripeSecretKey)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, signature, webhookSecret)
  } catch (err) {
    throw new AppError(`Webhook signature verification failed: ${(err as Error).message}`, 400)
  }

  await BillingService.processStripeWebhookEvent(event)

  res.json({ received: true })
})
