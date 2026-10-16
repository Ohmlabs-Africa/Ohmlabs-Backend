import 'dotenv/config';
import path from 'node:path';

const required = ['MONGO_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  accessExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromEmail: process.env.RESEND_FROM_EMAIL,
  bookingNotificationEmail: process.env.BOOKING_NOTIFICATION_EMAIL || 'keith@ohmlabs.africa',
  uploadDirectory: path.resolve(process.env.UPLOAD_DIRECTORY || 'uploads'),
  zohoWebhookSecret: process.env.ZOHO_WEBHOOK_SECRET,
};
