import { User } from '../models/User.js';
import { ok } from '../utils/response.js';
import { sendEmail } from '../utils/email.js';

const safe = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, approvalStatus: u.approvalStatus, createdAt: u.createdAt });
export async function listUsers(req, res) { return ok(res, (await User.find().sort({ createdAt: -1 })).map(safe)); }
export async function listPendingUsers(req, res) {
  const users = await User.find({ role: 'client', approvalStatus: 'pending' }).sort({ createdAt: 1 });
  return ok(res, users.map(safe), 'Pending client accounts fetched');
}
export async function createUser(req, res) {
  const user = await User.create({ ...req.body, isActive: true, approvalStatus: 'approved' });
  return ok(res, safe(user), 'User created', 201);
}
export async function updateUser(req, res) { const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); if (!user) return res.status(404).json({ success: false, error: 'User not found' }); return ok(res, safe(user), 'User updated'); }

export async function updateUserApproval(req, res) {
  const user = await User.findOne({ _id: req.params.id, role: 'client' });
  if (!user) return res.status(404).json({ success: false, error: 'Client account not found' });
  user.approvalStatus = req.body.approvalStatus;
  user.isActive = req.body.approvalStatus === 'approved';
  await user.save();

  let notificationSent = true;
  try {
    await sendEmail({
      to: user.email,
      subject: req.body.approvalStatus === 'approved' ? 'Your OHM Labs account is approved' : 'Update on your OHM Labs account request',
      text: req.body.approvalStatus === 'approved'
        ? 'Your OHM Labs account has been approved. You can now sign in at https://ohmlabs.africa/client/login and access your project workspace.'
        : 'Your OHM Labs account request was not approved at this time. Please contact keith@ohmlabs.africa if you need more information.',
    });
  } catch (error) {
    notificationSent = false;
    console.error(`Account approval notification failed for user ${user._id}:`, error);
  }
  return ok(res, { user: safe(user), notificationSent }, `Client account ${req.body.approvalStatus}`);
}
