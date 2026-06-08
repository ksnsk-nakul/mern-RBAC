import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize }    from '../../middleware/authorize.js'
import * as C from '../../controllers/admin/userRoles.controller.js'

export const userRolesAdminRouter = Router({ mergeParams: true })

userRolesAdminRouter.use(authenticate)

userRolesAdminRouter.get('/',           authorize('users.update'), C.list)
userRolesAdminRouter.post('/',          authorize('users.update'), C.assign)
userRolesAdminRouter.delete('/:roleId', authorize('users.update'), C.revoke)
