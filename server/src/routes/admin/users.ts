import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize }    from '../../middleware/authorize.js'
import * as C from '../../controllers/admin/users.controller.js'

export const usersAdminRouter = Router()

usersAdminRouter.use(authenticate)

usersAdminRouter.get('/',       authorize('users.view'),   C.list)
usersAdminRouter.get('/:id',    authorize('users.view'),   C.get)
usersAdminRouter.post('/',      authorize('users.create'), C.create)
usersAdminRouter.patch('/:id',  authorize('users.update'), C.update)
usersAdminRouter.delete('/:id', authorize('users.delete'), C.remove)
