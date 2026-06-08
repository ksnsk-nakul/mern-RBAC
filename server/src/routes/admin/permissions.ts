import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize }    from '../../middleware/authorize.js'
import * as C from '../../controllers/admin/permissions.controller.js'

export const permissionsAdminRouter = Router()

permissionsAdminRouter.use(authenticate)
permissionsAdminRouter.get('/', authorize('permissions.view'), C.list)
