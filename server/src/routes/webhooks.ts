import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { requireOrgRole } from '../middleware/requireOrgRole.js'
import * as C from '../controllers/webhooks.controller.js'

export const webhooksRouter = Router({ mergeParams: true })

webhooksRouter.use(authenticate)
webhooksRouter.use(requireOrgRole(['owner', 'admin']))

webhooksRouter.get('/',                                     C.list)
webhooksRouter.post('/',                                     C.create)
webhooksRouter.patch('/:id',                                 C.update)
webhooksRouter.delete('/:id',                                C.remove)
webhooksRouter.post('/:id/regenerate-secret',                C.regenerateSecret)
webhooksRouter.get('/:id/deliveries',                        C.listDeliveries)
webhooksRouter.post('/:id/deliveries/:deliveryId/retry',     C.retryDelivery)
