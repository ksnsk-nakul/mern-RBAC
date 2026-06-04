import { Router } from 'express'
import { passport } from '../lib/passport.js'
import { googleCallback } from '../controllers/googleAuth.controller.js'

export const googleAuthRouter = Router()

googleAuthRouter.get('/redirect',
  (req, res, next) => {
    const state = (req.query.roleRoute as string) ?? 'dashboard'
    passport.authenticate('google', {
      scope:   ['openid', 'profile', 'email'],
      state,
      session: false,
    })(req, res, next)
  },
)

googleAuthRouter.get('/callback',
  passport.authenticate('google', {
    session:          false,
    failureRedirect:  '/login/user?error=google_failed',
  }),
  googleCallback,
)
