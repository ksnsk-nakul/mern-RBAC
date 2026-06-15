import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import * as C from '../controllers/apiTokens.controller.js'

export const apiTokensRouter = Router()
apiTokensRouter.use(authenticate)

apiTokensRouter.get('/',       C.list)
apiTokensRouter.post('/',      C.create)
apiTokensRouter.delete('/:id', C.revoke)
