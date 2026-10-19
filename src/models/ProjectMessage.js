import mongoose from 'mongoose';

const projectMessageSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
}, { timestamps: true });

export const ProjectMessage = mongoose.model('ProjectMessage', projectMessageSchema);
