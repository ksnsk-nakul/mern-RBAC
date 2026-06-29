import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import * as C from '../controllers/licenses.controller.js'

export const licensesRouter = Router()

// Public verification endpoint — no auth
licensesRouter.post('/verify', C.verifyLicense)

// Admin-only routes
licensesRouter.get('/',  authenticate, authorize('tms.products.manage'), C.listLicenses)
licensesRouter.post('/', authenticate, authorize('tms.products.manage'), C.createLicense)
