import { env } from '../config/env.js';

export async function sendEmail({ to, subject, text, replyTo }) {
  if (!env.resendApiKey || !env.resendFromEmail) {
    throw new Error('RESEND_API_KEY and RESEND_FROM_EMAIL must be configured to send email');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.resendFromEmail, to, subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`Resend email request failed (${response.status}): ${responseBody}`);
  }
}
