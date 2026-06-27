import { Router } from 'express'
import { globalLimiter }           from '../middleware/rateLimiter.js'
import { authRouter }              from './auth.js'
import { googleAuthRouter }        from './googleAuth.js'
import { usersAdminRouter }        from './admin/users.js'
import { rolesAdminRouter }        from './admin/roles.js'
import { roleTemplatesAdminRouter } from './admin/roleTemplates.js'
import { approvalsAdminRouter }     from './admin/approvals.js'
import { approvalsRouter }           from './approvals.js'
import { permissionsAdminRouter }  from './admin/permissions.js'
import { userRolesAdminRouter }    from './admin/userRoles.js'
import { statsAdminRouter }        from './admin/stats.js'
import { settingsAdminRouter }     from './admin/settings.js'
import { loginConfigsAdminRouter }  from './admin/loginConfigs.js'
import { secretsAdminRouter }       from './admin/secrets.js'
import { logsAdminRouter }          from './admin/logs.js'
import { organizationsAdminRouter } from './admin/organizations.js'
import { billingAdminRouter }       from './admin/billing.js'
import { ticketsAdminRouter }       from './admin/tickets.js'
import { orgsRouter }               from './organizations.js'
import { webhooksRouter }           from './webhooks.js'
import { billingRouter }            from './billing.js'
import { mfaRouter }                from './mfa.js'
import { trustedDevicesRouter }    from './trustedDevices.js'
import { apiTokensRouter }         from './apiTokens.js'

export const router = Router()

router.use(globalLimiter)

router.get('/health', (_req, res) => { res.json({ status: 'ok' }) })

router.use('/auth',        authRouter)
router.use('/auth/google', googleAuthRouter)
router.use('/auth/mfa',     mfaRouter)
router.use('/auth/devices',     trustedDevicesRouter)
router.use('/auth/api-tokens', apiTokensRouter)
router.use('/auth/orgs',      orgsRouter)
router.use('/approvals', approvalsRouter)

router.use('/admin/users',               usersAdminRouter)
router.use('/admin/users/:userId/roles', userRolesAdminRouter)
router.use('/admin/roles/templates',     roleTemplatesAdminRouter)
router.use('/admin/approvals',           approvalsAdminRouter)
router.use('/admin/roles',               rolesAdminRouter)
router.use('/admin/permissions',         permissionsAdminRouter)
router.use('/admin/stats',               statsAdminRouter)
router.use('/admin/settings',            settingsAdminRouter)
router.use('/admin/login-configs',       loginConfigsAdminRouter)
router.use('/admin/secrets',             secretsAdminRouter)
router.use('/admin/logs',               logsAdminRouter)
router.use('/admin/orgs',              organizationsAdminRouter)
router.use('/admin/billing',           billingAdminRouter)
router.use('/admin/tickets',           ticketsAdminRouter)
router.use('/orgs/:orgId/webhooks',    webhooksRouter)
router.use('/orgs/:orgId/billing',     billingRouter)
