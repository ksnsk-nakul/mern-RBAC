import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { getStats } from '../../controllers/admin/stats.controller.js'

export const statsAdminRouter = Router()
statsAdminRouter.use(authenticate)
statsAdminRouter.get('/', getStats)
