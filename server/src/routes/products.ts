import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize }    from '../middleware/authorize.js'
import * as C from '../controllers/products.controller.js'

export const productsRouter = Router()

productsRouter.use(authenticate, authorize('tms.products.manage'))

productsRouter.get('/',      C.listProducts)
productsRouter.post('/',     C.createProduct)
productsRouter.get('/:id',   C.getProduct)
productsRouter.patch('/:id', C.updateProduct)
productsRouter.delete('/:id', C.deleteProduct)
