import rateLimit from 'express-rate-limit';

const options = {
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' }),
};

export const authActionLimiter = rateLimit({ ...options, windowMs: 15 * 60 * 1000, limit: 10 });
export const passwordResetLimiter = rateLimit({ ...options, windowMs: 15 * 60 * 1000, limit: 5 });
export const publicSubmissionLimiter = rateLimit({ ...options, windowMs: 60 * 60 * 1000, limit: 20 });
export const webhookLimiter = rateLimit({ ...options, windowMs: 15 * 60 * 1000, limit: 100 });
