import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { connectDatabase } from './config/db.js';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import clientRoutes from './routes/client.js';
import { errorHandler } from './middleware/errorHandler.js';
import { body } from 'express-validator';
import { createPublicSubmission, createSubmission } from './controllers/submissionController.js';
import { validate } from './utils/validate.js';
import { publicSubmissionLimiter, webhookLimiter } from './middleware/rateLimit.js';
import { contactAttachmentUpload, publicSubmissionUpload } from './middleware/upload.js';
import integrationRoutes from './routes/integrations.js';
import { parseDetails } from './middleware/parseDetails.js';
import { isValidProposalDetails } from './utils/proposalValidation.js';
import { verifyUploadSignature } from './middleware/verifyUploadSignature.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan('combined'));
app.get('/health', (req, res) => res.json({ success: true, data: { status: 'ok' }, message: 'Healthy' }));
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, error: 'Too many authentication requests. Please try again later.' }),
}), authRoutes);
app.post('/api/contact', publicSubmissionLimiter, contactAttachmentUpload, verifyUploadSignature, parseDetails, [
  body('name').trim().matches(/^[\p{L}\p{M}][\p{L}\p{M} .'\u2019-]{1,119}$/u),
  body('email').trim().isLength({ max: 254 }).isEmail().normalizeEmail(),
  body('company').optional({ checkFalsy: true }).trim().isLength({ max: 160 })
    .custom((value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value) && !/<\/?[a-z][^>]*>/i.test(value)),
  body('message').trim().isLength({ min: 1, max: 5000 })
    .custom((value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value) && !/<\/?[a-z][^>]*>/i.test(value)),
  body('details').optional().custom(isValidProposalDetails)
    .withMessage('Proposal details contain invalid or unsupported values'),
  body('website').optional().equals('').withMessage('Submission rejected'),
], validate, createSubmission);
app.post('/api/submissions', publicSubmissionLimiter, publicSubmissionUpload, verifyUploadSignature, parseDetails, [
  body('type').isIn(['font_submission', 'calendar_booking']),
  body('name').trim().isLength({ min: 2, max: 120 }),
  body('email').isEmail().normalizeEmail(),
  body('company').optional().trim().isLength({ max: 160 }),
  body('message').optional().trim().isLength({ max: 5000 }),
  body('fontName').optional().trim().isLength({ max: 160 }),
  body('fontFileUrl').optional().isURL({ require_protocol: true }).isLength({ max: 2048 }),
  body('bookingDate').optional().isISO8601(),
  body('bookingTime').optional().trim().isLength({ max: 80 }),
  body('timezone').optional().trim().isLength({ max: 100 }),
  body('service').optional().trim().isLength({ max: 200 }),
  body('details').optional().isObject(),
], validate, createPublicSubmission);
app.use('/api/admin', adminRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/integrations', webhookLimiter, integrationRoutes);
app.use((req, res) => res.status(404).json({ success: false, error: 'Route not found' }));
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  connectDatabase().then(() => app.listen(env.port, () => console.log(`API listening on port ${env.port}`))).catch((error) => { console.error('Database connection failed:', error); process.exit(1); });
}
export default app;
