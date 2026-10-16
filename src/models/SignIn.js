import mongoose from 'mongoose';

const signInSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
}, { timestamps: true });

export const SignIn = mongoose.model('SignIn', signInSchema);
