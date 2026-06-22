import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import * as C from '../../controllers/admin/billing.controller.js'

export const billingAdminRouter = Router()

billingAdminRouter.use(authenticate)

billingAdminRouter.get('/plans',       authorize('billing.view'),   C.list)
billingAdminRouter.post('/plans',      authorize('billing.manage'), C.create)
billingAdminRouter.patch('/plans/:id', authorize('billing.manage'), C.update)
