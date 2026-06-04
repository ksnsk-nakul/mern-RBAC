import { Router } from 'express'
import { rolePortal } from '../middleware/rolePortal.js'
import { authenticate } from '../middleware/authenticate.js'
import { authLimiter } from '../middleware/rateLimiter.js'
import { asyncHandler } from '../lib/errors.js'
import * as AuthController from '../controllers/auth.controller.js'

export const authRouter = Router()

authRouter.get('/login-config/:roleRoute', asyncHandler(rolePortal as any), AuthController.loginConfig)
authRouter.post('/login/:roleRoute', authLimiter, asyncHandler(rolePortal as any), AuthController.login)
authRouter.post('/refresh', AuthController.refresh)
authRouter.post('/logout', AuthController.logout)
authRouter.get('/me', authenticate, AuthController.me)
