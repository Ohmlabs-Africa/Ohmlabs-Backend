import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  type: { type: String, enum: ['contact', 'font_submission', 'calendar_booking'], default: 'contact', index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true },
  company: { type: String, trim: true, maxlength: 160 },
  message: { type: String, trim: true, maxlength: 5000 },
  fontName: { type: String, trim: true, maxlength: 160 },
  fontFileUrl: { type: String, trim: true, maxlength: 2048 },
  attachments: [{
    storageKey: { type: String, required: true },
    originalName: { type: String, required: true, maxlength: 255 },
    contentType: { type: String, required: true, maxlength: 120 },
    size: { type: Number, required: true },
  }],
  externalId: { type: String, trim: true, maxlength: 200 },
  notificationSent: { type: Boolean, default: false },
  bookingDate: { type: Date },
  bookingTime: { type: String, trim: true, maxlength: 80 },
  timezone: { type: String, trim: true, maxlength: 100 },
  bookingStatus: { type: String, enum: ['scheduled', 'canceled'], default: 'scheduled' },
  cancellationReason: { type: String, trim: true, maxlength: 1000 },
  service: { type: String, trim: true, maxlength: 200 },
  details: { type: mongoose.Schema.Types.Mixed },
  status: { type: String, enum: ['new', 'in_progress', 'closed'], default: 'new', index: true },
}, { timestamps: true });

submissionSchema.index({ externalId: 1 }, { unique: true, sparse: true });

export const Submission = mongoose.model('Submission', submissionSchema);
