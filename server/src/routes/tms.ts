import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import * as C from '../controllers/tms.controller.js'

export const tmsRouter = Router()

tmsRouter.use(authenticate)

tmsRouter.get('/stats', C.getDashboardStats)

tmsRouter.get('/projects',                C.listProjects)
tmsRouter.post('/projects',               C.createProject)
tmsRouter.get('/projects/:id',            C.getProject)
tmsRouter.patch('/projects/:id',          C.updateProject)
tmsRouter.delete('/projects/:id',         C.deleteProject)
tmsRouter.post('/projects/:id/archive',   C.archiveProject)
tmsRouter.post('/projects/:id/unarchive', C.unarchiveProject)

tmsRouter.get('/tasks/planner',           C.getPlanner)
tmsRouter.get('/tasks',                   C.listTasks)
tmsRouter.post('/tasks',                  C.createTask)
tmsRouter.get('/tasks/:id',               C.getTask)
tmsRouter.patch('/tasks/:id',             C.updateTask)
tmsRouter.delete('/tasks/:id',            C.deleteTask)
tmsRouter.post('/tasks/:id/complete',     C.completeTask)
tmsRouter.post('/tasks/:id/reopen',       C.reopenTask)

tmsRouter.post('/founder/text-to-project', C.textToProject)
