// server/src/routes/tickets.ts
import { Router } from 'express'
import multer from 'multer'
import { authenticate } from '../middleware/authenticate.js'
import * as C from '../controllers/tickets.controller.js'

const ALLOWED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain']

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) cb(null, true)
    else cb(new Error(`File type not allowed: ${file.mimetype}`))
  },
})

export const ticketsRouter = Router()

ticketsRouter.use(authenticate)

ticketsRouter.get('/',    C.list)
ticketsRouter.post('/',   upload.array('files'), C.create)
ticketsRouter.get('/:id', C.getOne)
ticketsRouter.post('/:id/messages', upload.array('files'), C.addMessage)
ticketsRouter.get('/:id/messages/:msgId/attachments/:fileId', C.getAttachment)
