import { connectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

await connectDatabase();
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
await User.findOneAndUpdate({ email }, { name: 'OHM Labs Admin', email, password, role: 'admin', isActive: true }, { upsert: true, new: true, setDefaultsOnInsert: true });
console.log(`Admin seeded: ${email}`);
process.exit(0);
