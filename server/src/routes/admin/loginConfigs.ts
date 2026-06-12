import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize }    from '../../middleware/authorize.js'
import * as C from '../../controllers/admin/loginConfigs.controller.js'

export const loginConfigsAdminRouter = Router()
loginConfigsAdminRouter.use(authenticate)
loginConfigsAdminRouter.get('/',        authorize('settings.view'),   C.list)
loginConfigsAdminRouter.put('/:roleId', authorize('settings.manage'), C.upsert)
