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

  const webhookSecret = await SecretsService.revealSecret('stripe.webhook_secret')

  // Stripe.webhooks is a static helper — signature verification needs only the
  // webhook secret, never the API secret key, so no Stripe client is constructed here.
  let event: Stripe.Event
  try {
    event = Stripe.webhooks.constructEvent(req.body as Buffer, signature, webhookSecret)
  } catch (err) {
    throw new AppError(`Webhook signature verification failed: ${(err as Error).message}`, 400)
  }

  await BillingService.processStripeWebhookEvent(event)

  res.json({ received: true })
})
