import { User } from '../models/User.js';
import { ok } from '../utils/response.js';

const safe = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, createdAt: u.createdAt });
export async function listUsers(req, res) { return ok(res, (await User.find().sort({ createdAt: -1 })).map(safe)); }
export async function createUser(req, res) { const user = await User.create(req.body); return ok(res, safe(user), 'User created', 201); }
export async function updateUser(req, res) { const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); if (!user) return res.status(404).json({ success: false, error: 'User not found' }); return ok(res, safe(user), 'User updated'); }
