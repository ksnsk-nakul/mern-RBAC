// server/src/routes/admin/tickets.ts
import { Router } from 'express'
import multer from 'multer'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize }    from '../../middleware/authorize.js'
import * as C from '../../controllers/admin/tickets.controller.js'

const ALLOWED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain']

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) cb(null, true)
    else cb(new Error(`File type not allowed: ${file.mimetype}`))
  },
})

export const ticketsAdminRouter = Router()

ticketsAdminRouter.use(authenticate)
ticketsAdminRouter.use(authorize('tickets.view'))

ticketsAdminRouter.get('/',    C.list)
ticketsAdminRouter.post('/',   upload.array('files'), C.create)
ticketsAdminRouter.get('/:id', C.getOne)
ticketsAdminRouter.patch('/:id', C.update)
ticketsAdminRouter.post('/:id/messages', upload.array('files'), C.addMessage)
ticketsAdminRouter.get('/:id/messages/:msgId/attachments/:fileId', C.getAttachment)
