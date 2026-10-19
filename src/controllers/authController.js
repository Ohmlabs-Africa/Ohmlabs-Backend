import { createHash, randomBytes } from 'node:crypto';
import { User } from '../models/User.js';
import { SignIn } from '../models/SignIn.js';
import { accessToken, refreshToken, verifyRefresh } from '../utils/tokens.js';
import { ok } from '../utils/response.js';
import { sendEmail } from '../utils/email.js';
import { env } from '../config/env.js';

const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 };
const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive });
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export async function register(req, res) {
  const { name, email, password } = req.body;
  const user = await User.create({
    name,
    email,
    password,
    role: 'client',
    isActive: false,
    approvalStatus: 'pending',
  });
  let notificationSent = true;
  try {
    await sendEmail({
      to: env.adminNotificationEmail,
      replyTo: user.email,
      subject: 'OHM Labs client account approval requested',
      text: [
        'A new client account is awaiting approval.',
        '',
        `Name: ${user.name}`,
        `Email: ${user.email}`,
        `User ID: ${user._id}`,
        '',
        'Review this request in the OHM Labs admin dashboard.',
      ].join('\n'),
    });
  } catch (error) {
    notificationSent = false;
    console.error(`Admin signup notification failed for user ${user._id}:`, error);
  }
  return ok(res, { user: publicUser(user), notificationSent }, 'Registration received. An administrator must approve your account before you can sign in.', 201);
}

export async function login(req, res) {
  const user = await User.findOne({ email: req.body.email }).select('+password +failedLoginAttempts +lockedUntil');
  if (!user || (user.lockedUntil && user.lockedUntil > new Date()) || !(await user.comparePassword(req.body.password))) {
    if (user) { user.failedLoginAttempts += 1; if (user.failedLoginAttempts >= 5) user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); await user.save(); }
    console.warn('Login failure for:', req.body.email);
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
  if (user.approvalStatus === 'pending') return res.status(403).json({ success: false, error: 'Your account is awaiting administrator approval.' });
  if (user.approvalStatus === 'rejected' || !user.isActive) return res.status(403).json({ success: false, error: 'This account is not approved for sign-in. Contact OHM Labs for assistance.' });
  user.failedLoginAttempts = 0; user.lockedUntil = null; await user.save();
  await SignIn.create({ user: user._id });
  res.cookie('refreshToken', refreshToken(user), cookieOptions);
  return ok(res, { user: publicUser(user), accessToken: accessToken(user) }, 'Logged in');
}

export async function forgotPassword(req, res) {
  const user = await User.findOne({ email: req.body.email, isActive: true });
  if (!user) return ok(res, null, 'If an account exists for that email, a password reset link will be sent');

  const token = randomBytes(32).toString('hex');
  user.passwordResetTokenHash = hashToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();

  const resetUrl = new URL('/reset-password', `${env.clientOrigin.replace(/\/+$/, '')}/`);
  resetUrl.searchParams.set('token', token);
  try {
    await sendEmail({
      to: user.email,
      subject: 'Reset your OHM Labs password',
      text: `Use this link to reset your password within 30 minutes:\n${resetUrl.toString()}\n\nIf you did not request this, you can ignore this email.`,
    });
  } catch (error) {
    console.error('Password reset email could not be sent:', error);
    return res.status(503).json({ success: false, error: 'Password reset email could not be sent. Please try again later.' });
  }
  return ok(res, null, 'If an account exists for that email, a password reset link will be sent');
}

export async function resetPassword(req, res) {
  const user = await User.findOne({
    passwordResetTokenHash: hashToken(req.body.token),
    passwordResetExpiresAt: { $gt: new Date() },
    isActive: true,
  }).select('+passwordResetTokenHash +passwordResetExpiresAt +failedLoginAttempts +lockedUntil');

  if (!user) return res.status(400).json({ success: false, error: 'Invalid or expired password reset token' });

  user.password = req.body.password;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();
  return ok(res, null, 'Password reset successfully');
}

export async function refresh(req, res) {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ success: false, error: 'Refresh token required' });
  let payload;
  try {
    payload = verifyRefresh(token);
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
  }
  const user = await User.findById(payload.id);
  if (!user || !user.isActive || (user.role === 'client' && user.approvalStatus !== 'approved')) {
    return res.status(401).json({ success: false, error: 'Account unavailable' });
  }
  res.cookie('refreshToken', refreshToken(user), cookieOptions);
  return ok(res, { accessToken: accessToken(user) }, 'Token refreshed');
}

export function logout(req, res) { res.clearCookie('refreshToken', cookieOptions); return ok(res, null, 'Logged out'); }
