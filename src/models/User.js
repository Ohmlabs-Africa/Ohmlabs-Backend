import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true, select: false, minlength: 8 },
  role: { type: String, enum: ['admin', 'client'], default: 'client' },
  isActive: { type: Boolean, default: true },
  failedLoginAttempts: { type: Number, default: 0, select: false },
  lockedUntil: { type: Date, default: null, select: false },
  passwordResetTokenHash: { type: String, select: false },
  passwordResetExpiresAt: { type: Date, select: false },
}, { timestamps: true });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model('User', userSchema);
