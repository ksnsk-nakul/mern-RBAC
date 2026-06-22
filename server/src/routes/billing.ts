import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { requireOrgRole } from '../middleware/requireOrgRole.js'
import * as C from '../controllers/billing.controller.js'

export const billingRouter = Router({ mergeParams: true })

billingRouter.use(authenticate)
billingRouter.use(requireOrgRole(['owner', 'admin']))

billingRouter.get('/',          C.overview)
billingRouter.post('/checkout', C.checkout)
billingRouter.post('/portal',   C.portal)
billingRouter.post('/cancel',   C.cancel)
billingRouter.get('/payments',  C.payments)
