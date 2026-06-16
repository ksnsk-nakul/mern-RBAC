import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import * as C from '../controllers/organizations.controller.js'

export const orgsRouter = Router()

orgsRouter.use(authenticate)

orgsRouter.get('/',               C.listMyOrgs)
orgsRouter.post('/invite/accept', C.acceptInvite)
orgsRouter.delete('/switch',      C.clearOrg)
orgsRouter.post('/:id/switch',    C.switchOrg)
