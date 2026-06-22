import express, { Router } from 'express'
import { handleStripeWebhook } from '../controllers/stripeWebhook.controller.js'

export const stripeWebhookRouter = Router()

stripeWebhookRouter.post('/', express.raw({ type: 'application/json' }), handleStripeWebhook)
