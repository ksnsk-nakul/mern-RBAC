import { Router } from 'express'
import { globalLimiter } from '../middleware/rateLimiter.js'
import { authRouter } from './auth.js'

export const router = Router()

router.use(globalLimiter)

router.get('/health', (_req, res) => { res.json({ status: 'ok' }) })

router.use('/auth', authRouter)
