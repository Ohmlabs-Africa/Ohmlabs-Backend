import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 5000, default: '' },
  status: { type: String, enum: ['planned', 'in_progress', 'on_hold', 'completed'], default: 'planned', index: true },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'member'], default: 'member' },
    addedAt: { type: Date, default: Date.now },
  }],
  startDate: { type: Date },
  dueDate: { type: Date },
}, { timestamps: true });

projectSchema.index({ 'members.user': 1, updatedAt: -1 });

export const Project = mongoose.model('Project', projectSchema);
