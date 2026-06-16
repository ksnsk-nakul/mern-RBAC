import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize }    from '../../middleware/authorize.js'
import * as LogsController from '../../controllers/admin/logs.controller.js'

export const logsAdminRouter = Router()

logsAdminRouter.use(authenticate)

logsAdminRouter.get('/activity',  authorize('logs.view'),   LogsController.listActivity)
logsAdminRouter.get('/login',     authorize('logs.view'),   LogsController.listLogin)
logsAdminRouter.get('/export',    authorize('logs.export'), LogsController.exportLogs)
logsAdminRouter.get('/integrity', authorize('logs.export'), LogsController.chainIntegrity)
