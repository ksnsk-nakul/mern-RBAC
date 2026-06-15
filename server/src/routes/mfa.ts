import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import * as C from '../controllers/mfa.controller.js'

export const mfaRouter = Router()
mfaRouter.use(authenticate)

mfaRouter.get('/status',               C.status)
mfaRouter.post('/setup',               C.setup)
mfaRouter.post('/enable',              C.enable)
mfaRouter.post('/disable',             C.disable)
mfaRouter.post('/recovery/regenerate', C.regenerateCodes)
