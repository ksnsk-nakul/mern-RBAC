import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import * as C from '../controllers/trustedDevices.controller.js'

export const trustedDevicesRouter = Router()
trustedDevicesRouter.use(authenticate)

trustedDevicesRouter.get('/',        C.list)
trustedDevicesRouter.post('/trust',  C.trust)
trustedDevicesRouter.delete('/all',  C.revokeAll)
trustedDevicesRouter.delete('/:id',  C.revoke)
