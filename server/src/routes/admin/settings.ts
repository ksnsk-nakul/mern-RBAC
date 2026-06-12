import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize }    from '../../middleware/authorize.js'
import * as C from '../../controllers/admin/settings.controller.js'

export const settingsAdminRouter = Router()

// Public settings (logo, app name, theme) — no auth needed
settingsAdminRouter.get('/public', C.listPublic)

// Admin routes
settingsAdminRouter.use(authenticate)
settingsAdminRouter.get('/',        authorize('settings.view'),   C.list)
settingsAdminRouter.patch('/:slug', authorize('settings.manage'), C.update)
