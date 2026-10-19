import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { createSubmission, listSubmissions, updateSubmission } from '../controllers/submissionController.js';
import { validate } from '../utils/validate.js';
import { createProjectRoutes } from './projectRoutes.js';
import { getClientDashboardStats, getCurrentUser, getProjectDashboardStats } from '../controllers/projectController.js';

const router = Router();
router.use(authenticate, authorize('client'));
router.use('/projects', createProjectRoutes());
router.get('/me', getCurrentUser);
router.get('/dashboard/stats', getClientDashboardStats);
router.get('/project-stats', getProjectDashboardStats);
router.get('/submissions', listSubmissions);
router.post('/submissions', [body('name').trim().notEmpty(), body('email').isEmail(), body('message').trim().isLength({ min: 1, max: 5000 })], validate, createSubmission);
router.patch('/submissions/:id', [body('status').optional().isIn(['new', 'in_progress', 'closed'])], validate, updateSubmission);
export default router;
