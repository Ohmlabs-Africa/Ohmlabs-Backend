import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { listUsers, listPendingUsers, createUser, updateUser, updateUserApproval } from '../controllers/userController.js';
import { downloadSubmissionAttachment, listSubmissions, updateSubmission } from '../controllers/submissionController.js';
import { validate } from '../utils/validate.js';
import { SignIn } from '../models/SignIn.js';
import { Submission } from '../models/Submission.js';
import { User } from '../models/User.js';
import { createProjectRoutes } from './projectRoutes.js';
import { getCurrentUser, getProjectDashboardStats, listMyProjectTasks } from '../controllers/projectController.js';

const router = Router();
router.use(authenticate, authorize('admin'));
router.get('/me', getCurrentUser);
router.use('/projects', createProjectRoutes());
router.get('/users/pending', listPendingUsers);
router.get('/project-stats', getProjectDashboardStats);
router.get('/project-tasks/assigned-to-me', listMyProjectTasks);
router.get('/users', listUsers);
router.post('/users', [body('name').trim().notEmpty(), body('email').isEmail(), body('password').isLength({ min: 8 }), body('role').isIn(['admin', 'client'])], validate, createUser);
router.patch('/users/:id', [body('role').optional().isIn(['admin', 'client']), body('isActive').optional().isBoolean()], validate, updateUser);
router.patch('/users/:id/approval', [body('approvalStatus').isIn(['approved', 'rejected'])], validate, updateUserApproval);
router.get('/submissions/:id/attachments/:storageKey', downloadSubmissionAttachment);
router.get('/submissions', listSubmissions);
router.patch('/submissions/:id', [body('status').optional().isIn(['new', 'in_progress', 'closed'])], validate, updateSubmission);
router.get('/dashboard/stats', async (req, res) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalUsers, activeUsers, totalSignIns, signInsLast30Days, signInsToday, totalSubmissions, submissionsByType] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    SignIn.countDocuments(),
    SignIn.countDocuments({ createdAt: { $gte: last30Days } }),
    SignIn.countDocuments({ createdAt: { $gte: today } }),
    Submission.countDocuments(),
    Submission.aggregate([{ $group: { _id: { $ifNull: ['$type', 'contact'] }, count: { $sum: 1 } } }]),
  ]);

  const submissionCounts = Object.fromEntries(submissionsByType.map(({ _id, count }) => [_id, count]));
  return res.json({
    success: true,
    data: {
      users: { total: totalUsers, active: activeUsers },
      signins: { total: totalSignIns, last30Days: signInsLast30Days, today: signInsToday },
      submissions: {
        total: totalSubmissions,
        byType: {
          contact: submissionCounts.contact || 0,
          font_submission: submissionCounts.font_submission || 0,
          calendar_booking: submissionCounts.calendar_booking || 0,
        },
      },
    },
    message: 'Stats fetched',
  });
});
export default router;
