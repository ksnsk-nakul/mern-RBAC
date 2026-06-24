import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize }    from '../../middleware/authorize.js'
import * as C from '../../controllers/admin/approvals.controller.js'

export const approvalsAdminRouter = Router()

approvalsAdminRouter.use(authenticate)
approvalsAdminRouter.use(authorize('approvals.manage'))

approvalsAdminRouter.get('/',             C.list)
approvalsAdminRouter.post('/:id/approve', C.approve)
approvalsAdminRouter.post('/:id/reject',  C.reject)
