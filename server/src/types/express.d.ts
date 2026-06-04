import type mongoose from 'mongoose'

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: mongoose.Types.ObjectId
        roleId: mongoose.Types.ObjectId
        permissions: string[]
      }
      portal?: {
        role: import('../models/Role.js').IRole & { _id: mongoose.Types.ObjectId }
      }
    }
  }
}
