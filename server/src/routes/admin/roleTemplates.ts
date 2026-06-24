import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize }    from '../../middleware/authorize.js'
import * as C from '../../controllers/admin/roleTemplates.controller.js'

export const roleTemplatesAdminRouter = Router()

roleTemplatesAdminRouter.use(authenticate)

roleTemplatesAdminRouter.get('/',       authorize('roles.manage'), C.list)
roleTemplatesAdminRouter.post('/',      authorize('roles.manage'), C.create)
roleTemplatesAdminRouter.delete('/:id', authorize('roles.manage'), C.remove)
