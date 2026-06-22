import express from 'express'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import { passport } from './lib/passport.js'
import { router } from './routes/index.js'
import { stripeWebhookRouter } from './routes/stripeWebhook.js'
import { errorHandler } from './middleware/errorHandler.js'

export function createApp() {
  const app = express()

  app.use(helmet())
  app.use(cookieParser())

  // Mounted before express.json() — Stripe webhook signature verification needs the raw body
  app.use('/webhooks/stripe', stripeWebhookRouter)

  app.use(express.json())
  app.use(morgan('dev'))
  app.use(passport.initialize())

  app.use('/api', router)

  app.use(errorHandler)

  return app
}
