import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import * as C from '../controllers/approvals.controller.js'

export const approvalsRouter = Router()

approvalsRouter.use(authenticate)

approvalsRouter.post('/requests',     C.submit)
approvalsRouter.get('/requests/mine', C.mine)
