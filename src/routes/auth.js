import { Router } from 'express';
import { body } from 'express-validator';
import { forgotPassword, login, logout, refresh, register, resetPassword } from '../controllers/authController.js';
import { validate } from '../utils/validate.js';
import { authActionLimiter, passwordResetLimiter } from '../middleware/rateLimit.js';

const router = Router();
const credentials = [body('email').isEmail().normalizeEmail(), body('password').isLength({ min: 8 })];
router.post('/register', authActionLimiter, [body('name').trim().isLength({ min: 2, max: 120 }), ...credentials], validate, register);
router.post('/login', authActionLimiter, credentials, validate, login);
router.post('/forgot-password', passwordResetLimiter, [body('email').isEmail().normalizeEmail()], validate, forgotPassword);
router.post('/reset-password', passwordResetLimiter, [
  body('token').isString().isLength({ min: 64, max: 64 }),
  body('password').isLength({ min: 8 }),
], validate, resetPassword);
router.post('/refresh', refresh);
router.post('/logout', logout);
export default router;
