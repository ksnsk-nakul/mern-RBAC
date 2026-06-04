import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { env } from '../config/env.js'
import { User } from '../models/User.js'
import { UserRole } from '../models/UserRole.js'
import { Role } from '../models/Role.js'

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL) {
  passport.use(
    new GoogleStrategy(
      {
        clientID:          env.GOOGLE_CLIENT_ID,
        clientSecret:      env.GOOGLE_CLIENT_SECRET,
        callbackURL:       env.GOOGLE_CALLBACK_URL,
        passReqToCallback: true,
      },
      async (req, _accessToken, _refreshToken, profile, done) => {
        try {
          const googleId  = profile.id
          const email     = profile.emails?.[0]?.value ?? ''
          const name      = profile.displayName ?? 'User'
          const avatarUrl = profile.photos?.[0]?.value

          if (!email) return done(new Error('No email from Google'))

          let user = await User.findOne({ $or: [{ googleId }, { email }] })

          if (!user) {
            user = await User.create({
              name,
              email,
              googleId,
              avatarUrl,
              password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
            })
          } else {
            user.googleId  = user.googleId || googleId
            user.avatarUrl = avatarUrl ?? user.avatarUrl
            user.name      = name
            await user.save()
          }

          const hasRole = await UserRole.exists({ userId: user._id, isActive: true })
          if (!hasRole) {
            const defaultRole = await Role.findOne({ isDefault: true })
            if (defaultRole) {
              await UserRole.create({
                userId:     user._id,
                roleId:     defaultRole._id,
                isPrimary:  true,
                isActive:   true,
                assignedAt: new Date(),
              })
            }
          }

          const roleRoute = (req.query.state as string) ?? 'dashboard'
          done(null, { userId: String(user._id), roleRoute })
        } catch (err) {
          done(err as Error)
        }
      },
    ),
  )
}

export { passport }
