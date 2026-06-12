import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import * as C from '../../controllers/admin/secrets.controller.js'

export const secretsAdminRouter = Router()
secretsAdminRouter.use(authenticate)

// list — any authenticated admin can see which secrets are set
secretsAdminRouter.get('/',             C.list)
// reveal — per-slug permission checked inside controller
secretsAdminRouter.get('/:slug/reveal', C.revealLimiter, C.reveal)
// update / delete — per-slug permission checked inside controller
secretsAdminRouter.put('/:slug',        C.update)
secretsAdminRouter.delete('/:slug',     C.remove)
