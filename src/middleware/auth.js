import { User } from '../models/User.js';
import { verifyAccess } from '../utils/tokens.js';

export async function authenticate(req, res, next) {
  try {
    const header = req.get('authorization');
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Authentication required' });
    const payload = verifyAccess(header.slice(7));
    const user = await User.findById(payload.id).select('+isActive');
    if (!user || !user.isActive) return res.status(401).json({ success: false, error: 'Account unavailable' });
    req.user = { id: user._id.toString(), role: user.role };
    next();
  } catch (error) {
    console.warn('Authentication failure:', error.message);
    return res.status(401).json({ success: false, error: 'Invalid or expired access token' });
  }
}
