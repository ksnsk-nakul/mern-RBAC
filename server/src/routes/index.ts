import { Router } from 'express'
import { globalLimiter }           from '../middleware/rateLimiter.js'
import { authRouter }              from './auth.js'
import { googleAuthRouter }        from './googleAuth.js'
import { usersAdminRouter }        from './admin/users.js'
import { rolesAdminRouter }        from './admin/roles.js'
import { permissionsAdminRouter }  from './admin/permissions.js'
import { userRolesAdminRouter }    from './admin/userRoles.js'
import { statsAdminRouter }        from './admin/stats.js'
import { settingsAdminRouter }     from './admin/settings.js'
import { loginConfigsAdminRouter }  from './admin/loginConfigs.js'
import { secretsAdminRouter }       from './admin/secrets.js'
import { mfaRouter }                from './mfa.js'
import { trustedDevicesRouter }    from './trustedDevices.js'

export const router = Router()

router.use(globalLimiter)

router.get('/health', (_req, res) => { res.json({ status: 'ok' }) })

router.use('/auth',        authRouter)
router.use('/auth/google', googleAuthRouter)
router.use('/auth/mfa',     mfaRouter)
router.use('/auth/devices', trustedDevicesRouter)

router.use('/admin/users',               usersAdminRouter)
router.use('/admin/users/:userId/roles', userRolesAdminRouter)
router.use('/admin/roles',               rolesAdminRouter)
router.use('/admin/permissions',         permissionsAdminRouter)
router.use('/admin/stats',               statsAdminRouter)
router.use('/admin/settings',            settingsAdminRouter)
router.use('/admin/login-configs',       loginConfigsAdminRouter)
router.use('/admin/secrets',             secretsAdminRouter)
