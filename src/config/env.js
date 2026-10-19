import 'dotenv/config';
import path from 'node:path';

const required = ['MONGO_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

function configuredClientOrigins(value) {
  const origins = [...new Set(value.split(',').map((origin) => origin.trim()).filter(Boolean))];
  if (origins.length === 0) throw new Error('CLIENT_ORIGIN must include at least one frontend origin');

  for (const origin of origins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Invalid frontend origin in CLIENT_ORIGIN: ${origin}`);
    }

    if (!['http:', 'https:'].includes(parsed.protocol) ||
      parsed.origin !== origin.replace(/\/+$/, '') ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash) {
      throw new Error(`CLIENT_ORIGIN entries must be exact HTTP(S) origins without a path: ${origin}`);
    }
  }

  return origins;
}

const clientOrigins = configuredClientOrigins(process.env.CLIENT_ORIGIN || 'http://localhost:3000');

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  accessExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  clientOrigin: clientOrigins[0],
  clientOrigins,
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromEmail: process.env.RESEND_FROM_EMAIL,
  bookingNotificationEmail: process.env.BOOKING_NOTIFICATION_EMAIL || 'keith@ohmlabs.africa',
  proposalNotificationEmail: process.env.PROPOSAL_NOTIFICATION_EMAIL || process.env.BOOKING_NOTIFICATION_EMAIL || 'keith@ohmlabs.africa',
  adminNotificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL || 'keith@ohmlabs.africa',
  uploadDirectory: path.resolve(process.env.UPLOAD_DIRECTORY || 'uploads'),
  zohoWebhookSecret: process.env.ZOHO_WEBHOOK_SECRET,
};
