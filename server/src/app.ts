import express from 'express'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import { router } from './routes/index.js'
import { errorHandler } from './middleware/errorHandler.js'

export function createApp() {
  const app = express()

  app.use(helmet())
  app.use(cookieParser())
  app.use(express.json())
  app.use(morgan('dev'))

  app.use('/api', router)

  app.use(errorHandler)

  return app
}
