import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize }    from '../../middleware/authorize.js'
import * as C from '../../controllers/admin/organizations.controller.js'

export const organizationsAdminRouter = Router()

organizationsAdminRouter.use(authenticate)

organizationsAdminRouter.get('/',                          authorize('orgs.view'),   C.list)
organizationsAdminRouter.get('/:id',                       authorize('orgs.view'),   C.get)
organizationsAdminRouter.post('/',                         authorize('orgs.manage'), C.create)
organizationsAdminRouter.patch('/:id',                     authorize('orgs.manage'), C.update)
organizationsAdminRouter.delete('/:id',                    authorize('orgs.manage'), C.remove)
organizationsAdminRouter.get('/:id/members',               authorize('orgs.view'),   C.listMembers)
organizationsAdminRouter.post('/:id/members',              authorize('orgs.manage'), C.addMember)
organizationsAdminRouter.post('/:id/invite',               authorize('orgs.manage'), C.inviteMember)
organizationsAdminRouter.delete('/:id/members/:userId',    authorize('orgs.manage'), C.removeMember)
