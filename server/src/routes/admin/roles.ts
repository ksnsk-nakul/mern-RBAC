import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize }    from '../../middleware/authorize.js'
import * as C from '../../controllers/admin/roles.controller.js'

export const rolesAdminRouter = Router()

rolesAdminRouter.use(authenticate)

rolesAdminRouter.get('/',                authorize('roles.view'),   C.list)
rolesAdminRouter.get('/:id',             authorize('roles.view'),   C.get)
rolesAdminRouter.post('/',               authorize('roles.manage'), C.create)
rolesAdminRouter.patch('/:id',           authorize('roles.manage'), C.update)
rolesAdminRouter.delete('/:id',          authorize('roles.manage'), C.remove)
rolesAdminRouter.put('/:id/permissions', authorize('roles.manage'), C.setPermissions)
